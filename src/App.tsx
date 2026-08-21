import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { ConfirmDialog, type ConfirmRequest } from "./components/ConfirmDialog";
import {
  EmptyState,
  ErrorBanner,
  SkeletonGrid,
  SkeletonList,
} from "./components/Feedback";
import { FeaturedGrid } from "./components/FeaturedGrid";
import { HistoryList } from "./components/HistoryList";
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
import { PackageDetailsDrawer } from "./components/PackageDetailsDrawer";
import { PackageList } from "./components/PackageList";
import type { RowAction } from "./components/PackageRow";
import { Sidebar, type Section } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import { FEATURED, findFeatured } from "./data/featured";
import { useDebounced } from "./hooks/useDebounced";
import { useLocalStorage, useStringSet } from "./hooks/useLocalStorage";
import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { useWingetEvents } from "./hooks/useWingetEvents";
import { t } from "./i18n";
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

type LoadState = "idle" | "loading" | "error";
interface BusyEntry {
  action: string;
  percent: number | null;
  name: string;
}

const MAX_LOG_LINES = 800;
const UPDATE_POLL_MS = 6 * 60 * 60 * 1000;

export default function App() {
  const { preference, setPreference } = useTheme();
  const { toasts, push, dismiss } = useToasts();

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

  const [upgradable, setUpgradable] = useState<Package[]>([]);
  const [upgradableState, setUpgradableState] = useState<LoadState>("loading");

  const [busy, setBusy] = useState<Record<string, BusyEntry>>({});
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useLocalStorage("wingman.logOpen", false);
  const [error, setError] = useState<WingetError | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [details, setDetails] = useState<Package | null>(null);
  const [elevation, setElevation] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const favorites = useStringSet("wingman.favorites");
  const pins = useStringSet("wingman.pins");
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>("wingman.history", []);

  const searchRef = useRef<HTMLInputElement>(null);
  const logId = useRef(0);
  const batchQueue = useRef<string[]>([]);
  const lastUpdateCount = useRef(0);

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
      return list;
    } catch (e) {
      setError(toWingetError(e));
      setUpgradableState("error");
      return [];
    }
  }, []);

  const checkStartup = useCallback(async () => {
    setStartupChecking(true);
    try {
      const info = await api.checkWinget();
      setStartup(info);
      if (!info.error) {
        // Kick both lists off together instead of chaining them.
        void Promise.all([loadInstalled(), loadUpgradable()]);
      }
    } catch (e) {
      setStartup({
        error: toWingetError(e),
        backend: "Cli",
        winget_version: null,
      });
    } finally {
      setStartupChecking(false);
    }
  }, [loadInstalled, loadUpgradable]);

  useEffect(() => {
    void checkStartup();
  }, [checkStartup]);

  // -- events ---------------------------------------------------------------

  const appendLog = useCallback((text: string, isError: boolean) => {
    setLogLines((prev) => {
      const next = [...prev, { id: logId.current++, text, isError }];
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
    });
  }, []);

  const finishBusy = useCallback((id: string) => {
    setBusy((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
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

  const runNextInBatch = useCallback(() => {
    const next = batchQueue.current.shift();
    if (!next) return;
    const pkg = installed.find((p) => p.id === next);
    setBusy((prev) => ({
      ...prev,
      [next]: { action: "uninstall", percent: null, name: pkg?.name || next },
    }));
    api.uninstall(next).catch((e) => {
      setError(toWingetError(e));
      finishBusy(next);
    });
  }, [installed, finishBusy]);

  const onDone = useCallback(
    (event: DoneEvent) => {
      const entry = busy[event.id];
      const name = entry?.name || findFeatured(event.id)?.name || event.id;
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
        void loadInstalled();
        void loadUpgradable();
      } else if (event.error) {
        if (isCancellation(event.error)) {
          push(t("toast.cancelled"), "info");
        } else if (needsElevation(event.error)) {
          setElevation(true);
        } else {
          setError(event.error);
        }
      }

      if (batchQueue.current.length > 0) runNextInBatch();
    },
    [busy, finishBusy, loadInstalled, loadUpgradable, push, setHistory, runNextInBatch],
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
    const timer = setInterval(() => {
      void loadUpgradable().then(async (list) => {
        if (list.length > 0 && list.length !== lastUpdateCount.current) {
          lastUpdateCount.current = list.length;
          try {
            const { isPermissionGranted, requestPermission, sendNotification } =
              await import("@tauri-apps/plugin-notification");
            let granted = await isPermissionGranted();
            if (!granted) granted = (await requestPermission()) === "granted";
            if (granted) {
              sendNotification({
                title: t("app.title"),
                body: t("toast.updatesAvailable", { n: list.length }),
              });
            }
          } catch {
            // Notifications are a nicety; the badge already shows the count.
          }
        }
      });
    }, UPDATE_POLL_MS);
    return () => clearInterval(timer);
  }, [loadUpgradable, startup]);

  // -- shortcuts ------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSection("discover");
        setTimeout(() => searchRef.current?.focus(), 0);
      } else if (ctrl && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const map: Record<string, Section> = {
          "1": "discover",
          "2": "installed",
          "3": "updates",
          "4": "history",
        };
        setSection(map[event.key]);
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

  const sortPackages = useCallback(
    (list: Package[]) =>
      [...list].sort((a, b) => {
        if (sortKey === "id") return a.id.localeCompare(b.id);
        if (sortKey === "source")
          return (
            (a.source ?? "").localeCompare(b.source ?? "") || a.name.localeCompare(b.name)
          );
        return (a.name || a.id).localeCompare(b.name || b.id);
      }),
    [sortKey],
  );

  const visibleInstalled = useMemo(() => {
    const needle = installedFilter.trim().toLowerCase();
    const filtered = needle
      ? installed.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle),
        )
      : installed;
    return sortPackages(filtered);
  }, [installed, installedFilter, sortPackages]);

  const favoriteEntries = useMemo(
    () => FEATURED.filter((p) => favorites.set.has(p.id)),
    [favorites.set],
  );

  const rowState = useCallback(
    (pkg: Package) => ({
      busy: busyIds.has(pkg.id),
      percent: busy[pkg.id]?.percent ?? null,
      installed: installedIds.has(pkg.id),
      favorite: favorites.set.has(pkg.id),
      pinned: pins.set.has(pkg.id),
      selected: selection.has(pkg.id),
    }),
    [busy, busyIds, installedIds, favorites.set, pins.set, selection],
  );

  // -- actions --------------------------------------------------------------

  const startAction = useCallback(
    (action: RowAction, pkg: Package, version?: string) => {
      setError(null);
      setBusy((prev) => ({
        ...prev,
        [pkg.id]: { action, percent: null, name: pkg.name || pkg.id },
      }));
      const call =
        action === "install"
          ? api.install(pkg.id, version)
          : action === "uninstall"
            ? api.uninstall(pkg.id)
            : api.upgrade(pkg.id);
      call.catch((e) => {
        setError(toWingetError(e));
        finishBusy(pkg.id);
      });
    },
    [finishBusy],
  );

  const handleAction = useCallback(
    (action: RowAction, pkg: Package) => {
      if (action === "uninstall") {
        setConfirm({
          title: t("confirm.uninstall.title", { name: pkg.name || pkg.id }),
          body: t("confirm.uninstall.body"),
          confirmLabel: t("action.uninstall"),
          destructive: true,
          onConfirm: () => startAction("uninstall", pkg),
        });
        return;
      }
      startAction(action, pkg);
    },
    [startAction],
  );

  const handleCancel = useCallback(
    (pkg: Package) => {
      void api.cancel(pkg.id).then((stopped) => {
        if (stopped) finishBusy(pkg.id);
      });
    },
    [finishBusy],
  );

  const handleInstallById = useCallback(
    (id: string, version?: string) => {
      const known =
        searchResults.find((p) => p.id === id) ??
        installed.find((p) => p.id === id) ??
        upgradable.find((p) => p.id === id);
      const featured = findFeatured(id);
      startAction(
        "install",
        known ?? {
          id,
          name: featured?.name ?? id,
          version: "",
          available: null,
          source: null,
        },
        version,
      );
    },
    [searchResults, installed, upgradable, startAction],
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
        setBusy((prev) => ({
          ...prev,
          "*": { action: "upgrade-all", percent: null, name: t("updates.upgradeAll") },
        }));
        api.upgradeAll().catch((e) => {
          setError(toWingetError(e));
          finishBusy("*");
        });
      },
    });
  }, [upgradable, pins.set, finishBusy]);

  const handleBatchUninstall = useCallback(() => {
    const ids = [...selection];
    if (ids.length === 0) return;
    const names = ids.map((id) => installed.find((p) => p.id === id)?.name || id);
    setConfirm({
      title: t("confirm.uninstallMany.title", { n: ids.length }),
      body: t("confirm.uninstallMany.body"),
      items: names,
      confirmLabel: t("action.uninstall"),
      destructive: true,
      onConfirm: () => {
        setSelection(new Set());
        batchQueue.current = [...ids];
        runNextInBatch();
      },
    });
  }, [selection, installed, runNextInBatch]);

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
        onConfirm: () => {
          setBusy((prev) => ({
            ...prev,
            "*": { action: "import", percent: null, name: t("installed.import") },
          }));
          api.importList(path).catch((e) => {
            setError(toWingetError(e));
            finishBusy("*");
          });
        },
      });
    } catch (e) {
      setError(toWingetError(e));
    }
  }, [finishBusy]);

  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const searchCount = searchResults.length;
  const showFeatured = section === "discover" && debouncedQuery.trim().length < 2;

  return (
    <div className={`app ${logOpen ? "with-log" : ""}`}>
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
      />

      <main className="content">
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
                : !showFeatured
                  ? t("search.results", { n: searchCount })
                  : ""}
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
            ) : searchCount === 0 ? (
              <EmptyState
                icon="🔍"
                title={t("search.empty", { q: debouncedQuery.trim() })}
              />
            ) : (
              <PackageList
                packages={searchResults}
                action="install"
                rowState={rowState}
                onAction={(action, pkg) =>
                  installedIds.has(pkg.id)
                    ? handleAction("uninstall", pkg)
                    : handleAction(action, pkg)
                }
                onCancel={handleCancel}
                onToggleFavorite={favorites.toggle}
                onDetails={setDetails}
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
                rowState={rowState}
                selectable
                onAction={handleAction}
                onCancel={handleCancel}
                onToggleFavorite={favorites.toggle}
                onToggleSelect={toggleSelect}
                onDetails={setDetails}
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
                rowState={rowState}
                showPin
                onAction={handleAction}
                onCancel={handleCancel}
                onToggleFavorite={favorites.toggle}
                onTogglePin={pins.toggle}
                onDetails={setDetails}
              />
            )}
          </>
        )}

        {section === "history" && (
          <HistoryList entries={history} onClear={() => setHistory([])} />
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

      {details && (
        <PackageDetailsDrawer
          pkg={details}
          installed={installedIds.has(details.id)}
          onClose={() => setDetails(null)}
          onInstallVersion={handleInstallById}
        />
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
