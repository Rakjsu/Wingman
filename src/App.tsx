import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { ConfirmDialog, type ConfirmRequest } from "./components/ConfirmDialog";
import {
  EmptyState,
  ErrorBanner,
  SkeletonGrid,
  SkeletonList,
} from "./components/Feedback";
import { FeaturedGrid } from "./components/FeaturedGrid";
import {
  IconDownload,
  IconRefresh,
  IconSearch,
  IconUpload,
  IconX,
} from "./components/Icons";
import { LogPanel, type LogLine } from "./components/LogPanel";
import { Modal } from "./components/Modal";
import { Onboarding } from "./components/Onboarding";
import { PackageList } from "./components/PackageList";
import type { RowAction } from "./components/PackageRow";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { Sidebar, type Section } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import { FEATURED, findFeatured } from "./data/featured";
import { useDebounced } from "./hooks/useDebounced";
import { useLocalStorage, useStringSet } from "./hooks/useLocalStorage";
import { useOperationQueue } from "./hooks/useOperationQueue";
import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { useWingetEvents } from "./hooks/useWingetEvents";
import { compareStrings, currentLang, setLang, t, type Lang } from "./i18n";
import { api } from "./lib/api";
import {
  errorMessage,
  isCancellation,
  needsElevation,
  toWingetError,
} from "./lib/errors";
import type {
  DoneEvent,
  HistoryEntry,
  Package,
  ProgressEvent,
  SortKey,
  StartupInfo,
  WingetError,
} from "./lib/types";

// Neither is needed to paint the first screen.
const PackageDetailsDrawer = lazy(() =>
  import("./components/PackageDetailsDrawer").then((m) => ({
    default: m.PackageDetailsDrawer,
  })),
);
const HistoryList = lazy(() =>
  import("./components/HistoryList").then((m) => ({ default: m.HistoryList })),
);

type LoadState = "idle" | "loading" | "error";
interface BusyEntry {
  action: RowAction | "upgrade-all" | "import";
  percent: number | null;
  name: string;
}

const MAX_LOG_LINES = 800;
const UPDATE_POLL_MS = 6 * 60 * 60 * 1000;

export default function App() {
  const { preference, setPreference } = useTheme();
  const { toasts, push, dismiss } = useToasts();

  const [lang, setLangState] = useState<Lang>(() => currentLang());
  const [startup, setStartup] = useState<StartupInfo | null>(null);
  const [startupChecking, setStartupChecking] = useState(true);

  const [section, setSection] = useLocalStorage<Section>("wingman.section", "discover");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 400);
  const [sourceFilter, setSourceFilter] = useLocalStorage<string>("wingman.source", "");

  const [searchResults, setSearchResults] = useState<Package[]>([]);
  const [searchState, setSearchState] = useState<LoadState>("idle");

  const [installed, setInstalled] = useState<Package[]>([]);
  const [installedState, setInstalledState] = useState<LoadState>("loading");
  const [installedFilter, setInstalledFilter] = useState("");
  const [sortKey, setSortKey] = useLocalStorage<SortKey>("wingman.sort", "name");
  const [sortDesc, setSortDesc] = useLocalStorage("wingman.sortDesc", false);

  const [upgradable, setUpgradable] = useState<Package[]>([]);
  const [upgradableState, setUpgradableState] = useState<LoadState>("loading");
  const [upgradesLoaded, setUpgradesLoaded] = useState(false);

  const [busy, setBusy] = useState<Record<string, BusyEntry>>({});
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useLocalStorage("wingman.logOpen", false);
  const [error, setError] = useState<WingetError | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [details, setDetails] = useState<Package | null>(null);
  const [elevation, setElevation] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const favorites = useStringSet("wingman.favorites");
  const pins = useStringSet("wingman.pins");
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>("wingman.history", []);

  const searchRef = useRef<HTMLInputElement>(null);
  const logId = useRef(0);
  const lastUpdateCount = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- data loading ---------------------------------------------------------

  const loadInstalled = useCallback(async () => {
    setInstalledState("loading");
    try {
      setInstalled(await api.listInstalled());
      setInstalledState("idle");
    } catch (e) {
      setError(toWingetError(e));
      setInstalledState("error");
    }
  }, []);

  const loadUpgradable = useCallback(async () => {
    setUpgradableState("loading");
    try {
      const list = await api.listUpgradable();
      setUpgradable(list);
      setUpgradableState("idle");
      setUpgradesLoaded(true);
      return list;
    } catch (e) {
      setError(toWingetError(e));
      setUpgradableState("error");
      return [];
    }
  }, []);

  /** Coalesce the refreshes that follow a burst of queued operations. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void loadInstalled();
      void loadUpgradable();
    }, 800);
  }, [loadInstalled, loadUpgradable]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const checkStartup = useCallback(async () => {
    setStartupChecking(true);
    try {
      const info = await api.checkWinget();
      setStartup(info);
      if (!info.error) void loadInstalled();
    } catch (e) {
      setStartup({ error: toWingetError(e), backend: "Cli", winget_version: null });
    } finally {
      setStartupChecking(false);
    }
  }, [loadInstalled]);

  useEffect(() => {
    void checkStartup();
  }, [checkStartup]);

  // Upgrades are the slowest query, so only pay for it when the tab is opened.
  useEffect(() => {
    if (section === "updates" && !upgradesLoaded && !startup?.error) {
      void loadUpgradable();
    }
  }, [section, upgradesLoaded, startup, loadUpgradable]);

  // -- operation queue ------------------------------------------------------

  const queue = useOperationQueue(
    useCallback((op) => {
      setBusy((prev) => ({
        ...prev,
        [op.id]: {
          action: (op.label as BusyEntry["action"]) ?? "install",
          percent: null,
          name: op.id,
        },
      }));
    }, []),
  );

  const finishBusy = useCallback(
    (id: string) => {
      setBusy((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      queue.complete(id);
    },
    [queue],
  );

  // -- events ---------------------------------------------------------------

  const appendLog = useCallback((text: string, isError: boolean) => {
    setLogLines((prev) => {
      const next = [...prev, { id: logId.current++, text, isError }];
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
    });
  }, []);

  const onProgress = useCallback(
    (event: ProgressEvent) => {
      const isErr = event.isStderr ?? event.is_stderr ?? false;
      if (event.line) appendLog(`[${event.action}] ${event.line}`, isErr);
      if (event.percent !== null && event.percent !== undefined) {
        setBusy((prev) => {
          const entry = prev[event.id];
          if (!entry) return prev;
          return { ...prev, [event.id]: { ...entry, percent: event.percent } };
        });
      }
    },
    [appendLog],
  );

  const onDone = useCallback(
    (event: DoneEvent) => {
      const name = busy[event.id]?.name || findFeatured(event.id)?.name || event.id;
      finishBusy(event.id);

      setHistory((prev) =>
        [
          {
            id: event.id,
            action: event.action,
            ok: event.ok,
            at: Date.now(),
            errorKind: event.error?.kind,
          },
          ...prev,
        ].slice(0, 200),
      );

      if (event.ok) {
        const toastKey =
          event.action === "install"
            ? "toast.installed"
            : event.action === "uninstall"
              ? "toast.uninstalled"
              : event.action === "upgrade"
                ? "toast.upgraded"
                : event.action === "import"
                  ? "toast.imported"
                  : "toast.upgradedAll";
        push(t(toastKey, { name }), "success");
        if (event.action === "import") push(t("import.skipped"), "info");
        scheduleRefresh();
      } else if (event.error) {
        if (isCancellation(event.error)) {
          push(t("toast.cancelled"), "info");
        } else if (needsElevation(event.error)) {
          setElevation(true);
        } else {
          setError(event.error);
        }
      }
    },
    [busy, finishBusy, push, setHistory, scheduleRefresh],
  );

  useWingetEvents(onProgress, onDone);

  // -- search ---------------------------------------------------------------

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchState("idle");
      return;
    }
    let cancelled = false;
    setSearchState("loading");
    api
      .search(q, sourceFilter || undefined)
      .then((results) => {
        if (cancelled) return;
        setSearchResults(results);
        setSearchState("idle");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(toWingetError(e));
        setSearchState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, sourceFilter]);

  // -- background update check ---------------------------------------------

  useEffect(() => {
    if (startup?.error) return;

    const notifyIfNeeded = async (count: number) => {
      if (count === 0 || count === lastUpdateCount.current) return;
      lastUpdateCount.current = count;
      try {
        const { isPermissionGranted, requestPermission, sendNotification } =
          await import("@tauri-apps/plugin-notification");
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        if (granted) {
          sendNotification({
            title: t("app.title"),
            body: t("toast.updatesAvailable", { n: count }),
          });
        }
      } catch (e) {
        console.warn("wingman: notification unavailable", e);
      }
    };

    // Check once at startup rather than making the user wait a whole interval.
    const first = setTimeout(() => {
      void loadUpgradable().then((list) => void notifyIfNeeded(list.length));
    }, 4000);
    const timer = setInterval(() => {
      void loadUpgradable().then((list) => void notifyIfNeeded(list.length));
    }, UPDATE_POLL_MS);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [loadUpgradable, startup]);

  // -- shortcuts ------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && (event.key.toLowerCase() === "f" || event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setSection("discover");
        setTimeout(() => searchRef.current?.focus(), 0);
      } else if (ctrl && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        setSection(
          (
            { "1": "discover", "2": "installed", "3": "updates", "4": "history" } as const
          )[event.key as "1" | "2" | "3" | "4"],
        );
      } else if (event.key === "?" && !typing) {
        event.preventDefault();
        setShortcuts(true);
      } else if (event.key === "Escape") {
        setError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSection]);

  // -- derived --------------------------------------------------------------

  const installedIds = useMemo(() => new Set(installed.map((p) => p.id)), [installed]);
  const busyIds = useMemo(() => new Set(Object.keys(busy)), [busy]);
  const queuedIds = useMemo(() => new Set(queue.pending), [queue.pending]);

  const visibleInstalled = useMemo(() => {
    const needle = installedFilter.trim().toLowerCase();
    const filtered = needle
      ? installed.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle),
        )
      : installed;

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "id") return compareStrings(a.id, b.id);
      if (sortKey === "source")
        return (
          compareStrings(a.source ?? "", b.source ?? "") ||
          compareStrings(a.name || a.id, b.name || b.id)
        );
      return compareStrings(a.name || a.id, b.name || b.id);
    });
    return sortDesc ? sorted.reverse() : sorted;
  }, [installed, installedFilter, sortKey, sortDesc]);

  const favoriteEntries = useMemo(
    () => FEATURED.filter((p) => favorites.set.has(p.id)),
    [favorites.set],
  );

  const rowState = useCallback(
    (pkg: Package) => ({
      busy: busyIds.has(pkg.id),
      queued: queuedIds.has(pkg.id),
      percent: busy[pkg.id]?.percent ?? null,
      installed: installedIds.has(pkg.id),
      favorite: favorites.set.has(pkg.id),
      pinned: pins.set.has(pkg.id),
      selected: selection.has(pkg.id),
    }),
    [busy, busyIds, queuedIds, installedIds, favorites.set, pins.set, selection],
  );

  // -- actions --------------------------------------------------------------

  const enqueueAction = useCallback(
    (action: RowAction, pkg: Package, version?: string) => {
      setError(null);
      queue.enqueue({
        id: pkg.id,
        label: action,
        run: () =>
          (action === "install"
            ? api.install(pkg.id, version)
            : action === "uninstall"
              ? api.uninstall(pkg.id)
              : api.upgrade(pkg.id)
          ).catch((e) => {
            setError(toWingetError(e));
            finishBusy(pkg.id);
          }),
      });
      // The queue only knows ids; carry the display name for toasts.
      setBusy((prev) =>
        prev[pkg.id]
          ? { ...prev, [pkg.id]: { ...prev[pkg.id], name: pkg.name || pkg.id } }
          : prev,
      );
    },
    [queue, finishBusy],
  );

  const handleAction = useCallback(
    (action: RowAction, pkg: Package) => {
      if (action === "uninstall") {
        setConfirm({
          title: t("confirm.uninstall.title", { name: pkg.name || pkg.id }),
          body: t("confirm.uninstall.body"),
          confirmLabel: t("action.uninstall"),
          destructive: true,
          onConfirm: () => enqueueAction("uninstall", pkg),
        });
        return;
      }
      enqueueAction(action, pkg);
    },
    [enqueueAction],
  );

  const handleCancel = useCallback(
    (pkg: Package) => {
      const percent = busy[pkg.id]?.percent ?? 0;
      const stop = () => {
        void api.cancel(pkg.id).then((stopped) => {
          if (stopped) finishBusy(pkg.id);
        });
      };
      // Losing a nearly-finished install is worth one question.
      if (percent >= 80) {
        setConfirm({
          title: t("confirm.cancel.title", { name: pkg.name || pkg.id }),
          body: t("confirm.cancel.body", { percent }),
          confirmLabel: t("confirm.cancel.action"),
          destructive: true,
          onConfirm: stop,
        });
        return;
      }
      queue.remove(pkg.id);
      stop();
    },
    [busy, finishBusy, queue],
  );

  const packageFor = useCallback(
    (id: string): Package => {
      const known =
        searchResults.find((p) => p.id === id) ??
        installed.find((p) => p.id === id) ??
        upgradable.find((p) => p.id === id);
      if (known) return known;
      const featured = findFeatured(id);
      return {
        id,
        name: featured?.name ?? id,
        version: "",
        available: null,
        source: null,
      };
    },
    [searchResults, installed, upgradable],
  );

  const handleInstallById = useCallback(
    (id: string, version?: string) => enqueueAction("install", packageFor(id), version),
    [enqueueAction, packageFor],
  );

  const handleUpgradeAll = useCallback(() => {
    const targets = upgradable.filter((p) => !pins.set.has(p.id));
    if (targets.length === 0) return;
    setConfirm({
      title: t("confirm.upgradeAll.title", { n: targets.length }),
      body: t("confirm.upgradeAll.body"),
      items: targets.map((p) => p.name || p.id),
      confirmLabel: t("updates.upgradeAll"),
      onConfirm: () => {
        setError(null);
        queue.enqueue({
          id: "*",
          label: "upgrade-all",
          run: () =>
            api.upgradeAll().catch((e) => {
              setError(toWingetError(e));
              finishBusy("*");
            }),
        });
      },
    });
  }, [upgradable, pins.set, queue, finishBusy]);

  const handleBatchUninstall = useCallback(() => {
    const ids = [...selection];
    if (ids.length === 0) return;
    setConfirm({
      title: t("confirm.uninstallMany.title", { n: ids.length }),
      body: t("confirm.uninstallMany.body"),
      items: ids.map((id) => installed.find((p) => p.id === id)?.name || id),
      confirmLabel: t("action.uninstall"),
      destructive: true,
      onConfirm: () => {
        setSelection(new Set());
        // The queue runs these one at a time, which is what winget requires.
        queue.enqueue(
          ids.map((id) => ({
            id,
            label: "uninstall",
            run: () =>
              api.uninstall(id).catch((e) => {
                setError(toWingetError(e));
                finishBusy(id);
              }),
          })),
        );
      },
    });
  }, [selection, installed, queue, finishBusy]);

  const handleExport = useCallback(async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: t("installed.export"),
        defaultPath: "wingman-packages.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await api.exportList(path);
      push(t("toast.exported"), "success");
    } catch (e) {
      setError(toWingetError(e));
    }
  }, [push]);

  const handleImport = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        title: t("installed.import"),
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof path !== "string") return;
      setConfirm({
        title: t("confirm.import.title"),
        body: t("confirm.import.body"),
        confirmLabel: t("installed.import"),
        onConfirm: () =>
          queue.enqueue({
            id: "*",
            label: "import",
            run: () =>
              api.importList(path).catch((e) => {
                setError(toWingetError(e));
                finishBusy("*");
              }),
          }),
      });
    } catch (e) {
      setError(toWingetError(e));
    }
  }, [queue, finishBusy]);

  const copyId = useCallback(
    (id: string) => {
      navigator.clipboard
        .writeText(id)
        .then(() => push(t("toast.copiedId"), "success"))
        .catch((e) => console.warn("wingman: clipboard unavailable", e));
    },
    [push],
  );

  const openHomepage = useCallback((pkg: Package) => {
    api
      .show(pkg.id)
      .then((d) => (d.homepage ? api.openUrl(d.homepage) : undefined))
      .catch((e) => setError(toWingetError(e)));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const changeLang = useCallback((next: Lang) => {
    setLang(next);
    setLangState(next);
  }, []);

  // -- render ---------------------------------------------------------------

  if (
    startup?.error &&
    (startup.error.kind === "NotInstalled" || startup.error.kind === "Unsupported")
  ) {
    return (
      <Onboarding
        error={startup.error}
        onRetry={() => void checkStartup()}
        checking={startupChecking}
      />
    );
  }

  const showFeatured = section === "discover" && debouncedQuery.trim().length < 2;

  const listHandlers = {
    rowState,
    onAction: handleAction,
    onCancel: handleCancel,
    onToggleFavorite: favorites.toggle,
    onDetails: setDetails,
    onCopyId: copyId,
    onOpenHomepage: openHomepage,
  };

  return (
    // Remounting on language change is what makes the switch take effect: `t`
    // is a plain function, so nothing else would re-read the dictionary.
    <div className={`app ${logOpen ? "with-log" : ""}`} key={lang}>
      <a className="skip-link" href="#main">
        {t("a11y.skip")}
      </a>

      <Sidebar
        active={section}
        onChange={setSection}
        updateCount={upgradable.length}
        installedCount={installed.length}
        theme={preference}
        onThemeChange={setPreference}
        onToggleLog={() => setLogOpen((v) => !v)}
        logOpen={logOpen}
        appVersion={startup?.appVersion ?? startup?.app_version ?? "0.1.0"}
        lang={lang}
        onLangChange={changeLang}
        onShowShortcuts={() => setShortcuts(true)}
      />

      <main className="content" id="main">
        {error && (
          <ErrorBanner
            message={errorMessage(error)}
            onDismiss={() => setError(null)}
            onRetry={
              section === "installed"
                ? () => void loadInstalled()
                : section === "updates"
                  ? () => void loadUpgradable()
                  : undefined
            }
          />
        )}

        {section === "discover" && (
          <>
            <div className="toolbar toolbar-search">
              <div className="search-wrap">
                <IconSearch className="search-icon" />
                <input
                  ref={searchRef}
                  className="search"
                  type="search"
                  value={query}
                  placeholder={t("search.placeholder")}
                  aria-label={t("search.placeholder")}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="icon-btn search-clear"
                    onClick={() => setQuery("")}
                    title={t("search.clear")}
                  >
                    <IconX />
                    <span className="sr-only">{t("search.clear")}</span>
                  </button>
                )}
              </div>
              <label className="select-wrap">
                <span className="sr-only">{t("source.label")}</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.currentTarget.value)}
                >
                  <option value="">{t("source.all")}</option>
                  <option value="winget">winget</option>
                  <option value="msstore">msstore</option>
                </select>
              </label>
            </div>

            <p className="status-line" aria-live="polite">
              {searchState === "loading"
                ? t("search.loading")
                : showFeatured
                  ? ""
                  : t("search.results", { n: searchResults.length })}
            </p>

            {showFeatured ? (
              <FeaturedGrid
                installedIds={installedIds}
                busyIds={busyIds}
                favorites={favorites.set}
                favoriteEntries={favoriteEntries}
                onInstall={handleInstallById}
                onToggleFavorite={favorites.toggle}
              />
            ) : searchState === "loading" ? (
              <SkeletonList />
            ) : searchResults.length === 0 ? (
              <EmptyState
                icon="🔍"
                title={t("search.empty", { q: debouncedQuery.trim() })}
              />
            ) : (
              <PackageList
                packages={searchResults}
                action="install"
                {...listHandlers}
                onAction={(action, pkg) =>
                  installedIds.has(pkg.id)
                    ? handleAction("uninstall", pkg)
                    : handleAction(action, pkg)
                }
              />
            )}
          </>
        )}

        {section === "installed" && (
          <>
            <div className="toolbar">
              <div className="search-wrap search-wrap-sm">
                <IconSearch className="search-icon" />
                <input
                  className="search"
                  type="search"
                  value={installedFilter}
                  placeholder={t("installed.filter")}
                  aria-label={t("installed.filter")}
                  onChange={(e) => setInstalledFilter(e.currentTarget.value)}
                />
              </div>
              <label className="select-wrap">
                <span className="sr-only">{t("sort.label")}</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.currentTarget.value as SortKey)}
                >
                  <option value="name">{t("sort.name")}</option>
                  <option value="id">{t("sort.id")}</option>
                  <option value="source">{t("sort.source")}</option>
                </select>
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                aria-pressed={sortDesc}
                title={t("sort.direction")}
                onClick={() => setSortDesc((v) => !v)}
              >
                {sortDesc ? "↓" : "↑"}
                <span className="sr-only">{t("sort.direction")}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void loadInstalled()}
              >
                <IconRefresh /> {t("installed.refresh")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void handleExport()}
              >
                <IconDownload /> {t("installed.export")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void handleImport()}
              >
                <IconUpload /> {t("installed.import")}
              </button>
              <span className="counter" aria-live="polite">
                {t("installed.count", { n: installed.length })}
              </span>
            </div>

            {selection.size > 0 && (
              <div className="selection-bar" role="region" aria-live="polite">
                <span>{t("installed.selected", { n: selection.size })}</span>
                <button
                  type="button"
                  className="btn btn-uninstall-solid btn-sm"
                  onClick={handleBatchUninstall}
                >
                  {t("installed.uninstallSelected")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelection(new Set())}
                >
                  {t("installed.clearSelection")}
                </button>
              </div>
            )}

            {installedState === "loading" ? (
              <SkeletonList />
            ) : visibleInstalled.length === 0 ? (
              <EmptyState icon="📦" title={t("installed.empty")} />
            ) : (
              <PackageList
                packages={visibleInstalled}
                action="uninstall"
                selectable
                onToggleSelect={toggleSelect}
                {...listHandlers}
              />
            )}
          </>
        )}

        {section === "updates" && (
          <>
            <div className="toolbar">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void loadUpgradable()}
              >
                <IconRefresh /> {t("updates.refresh")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpgradeAll}
                disabled={busyIds.has("*") || upgradable.length === 0}
              >
                {busyIds.has("*") ? t("updates.upgradingAll") : t("updates.upgradeAll")}
              </button>
              <span className="counter" aria-live="polite">
                {t("updates.count", { n: upgradable.length })}
              </span>
            </div>

            {upgradableState === "loading" ? (
              <SkeletonList rows={4} />
            ) : upgradable.length === 0 ? (
              <EmptyState icon="✅" title={t("updates.empty")} />
            ) : (
              <PackageList
                packages={upgradable}
                action="upgrade"
                showPin
                onTogglePin={pins.toggle}
                {...listHandlers}
              />
            )}
          </>
        )}

        {section === "history" && (
          <Suspense fallback={<SkeletonList rows={4} />}>
            <HistoryList
              entries={history}
              onClear={() => setHistory([])}
              onReinstall={handleInstallById}
            />
          </Suspense>
        )}

        {startupChecking && !startup && <SkeletonGrid />}
      </main>

      {logOpen && (
        <LogPanel
          lines={logLines}
          onClear={() => setLogLines([])}
          onClose={() => setLogOpen(false)}
          onCopied={() => push(t("log.copied"), "success")}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}

      {details && (
        <Suspense fallback={null}>
          <PackageDetailsDrawer
            pkg={details}
            installed={installedIds.has(details.id)}
            onClose={() => setDetails(null)}
            onInstallVersion={handleInstallById}
          />
        </Suspense>
      )}

      {elevation && (
        <Modal
          title={t("elevate.title")}
          onClose={() => setElevation(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setElevation(false)}
              >
                {t("elevate.later")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void api.relaunchElevated().catch((e) => setError(toWingetError(e)));
                  setElevation(false);
                }}
              >
                {t("elevate.action")}
              </button>
            </>
          }
        >
          <p>{t("elevate.body")}</p>
        </Modal>
      )}
    </div>
  );
}
