import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { FeaturedGrid } from "./components/FeaturedGrid";
import { LogPanel } from "./components/LogPanel";
import { PackageList } from "./components/PackageList";
import { TabNav, type Tab } from "./components/TabNav";
import { t } from "./i18n";
import {
  type DoneEvent,
  type Package,
  type ProgressEvent,
  useDebounced,
  useWingetEvents,
  wingetApi,
} from "./hooks/useWinget";

type LoadState = "idle" | "loading" | "error";

function App() {
  const [tab, setTab] = useState<Tab>("discover");

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 400);
  const [searchResults, setSearchResults] = useState<Package[]>([]);
  const [searchState, setSearchState] = useState<LoadState>("idle");

  const [installed, setInstalled] = useState<Package[]>([]);
  const [installedState, setInstalledState] = useState<LoadState>("idle");

  const [upgradable, setUpgradable] = useState<Package[]>([]);
  const [upgradableState, setUpgradableState] = useState<LoadState>("idle");

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [logLines, setLogLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadInstalled = useCallback(async () => {
    setInstalledState("loading");
    try {
      setInstalled(await wingetApi.listInstalled());
      setInstalledState("idle");
    } catch (e) {
      setError(String(e));
      setInstalledState("error");
    }
  }, []);

  const loadUpgradable = useCallback(async () => {
    setUpgradableState("loading");
    try {
      setUpgradable(await wingetApi.listUpgradable());
      setUpgradableState("idle");
    } catch (e) {
      setError(String(e));
      setUpgradableState("error");
    }
  }, []);

  useWingetEvents(
    useCallback((e: ProgressEvent) => {
      setLogLines((prev) => [...prev.slice(-500), `[${e.action}] ${e.line}`]);
    }, []),
    useCallback(
      (e: DoneEvent) => {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(e.id);
          return next;
        });
        if (!e.ok && e.error) setError(e.error);
        if (e.ok && ["install", "uninstall", "upgrade", "upgrade-all"].includes(e.action)) {
          loadInstalled();
          loadUpgradable();
        }
      },
      [loadInstalled, loadUpgradable],
    ),
  );

  useEffect(() => {
    loadInstalled();
    loadUpgradable();
  }, [loadInstalled, loadUpgradable]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchState("idle");
      return;
    }
    let cancelled = false;
    setSearchState("loading");
    wingetApi
      .search(q)
      .then((r) => {
        if (!cancelled) {
          setSearchResults(r);
          setSearchState("idle");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setSearchState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const ctrl = ev.ctrlKey || ev.metaKey;
      if (ctrl && ev.key.toLowerCase() === "f") {
        ev.preventDefault();
        setTab("discover");
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else if (ctrl && ev.key === "1") {
        ev.preventDefault();
        setTab("discover");
      } else if (ctrl && ev.key === "2") {
        ev.preventDefault();
        setTab("installed");
      } else if (ctrl && ev.key === "3") {
        ev.preventDefault();
        setTab("updates");
      } else if (ev.key === "Escape") {
        setError(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleAction = useCallback(
    (action: "install" | "uninstall" | "upgrade", id: string) => {
      setBusyIds((prev) => new Set(prev).add(id));
      setError(null);
      const p =
        action === "install"
          ? wingetApi.install(id)
          : action === "uninstall"
          ? wingetApi.uninstall(id)
          : wingetApi.upgrade(id);
      p.catch((e) => setError(String(e)));
    },
    [],
  );

  const handleUpgradeAll = useCallback(() => {
    setBusyIds((prev) => new Set(prev).add("*"));
    setError(null);
    wingetApi.upgradeAll().catch((e) => setError(String(e)));
  }, []);

  const installedIds = useMemo(() => new Set(installed.map((p) => p.id)), [installed]);
  const showFeatured = tab === "discover" && debouncedQuery.trim().length < 2;

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <img src="/wingman.svg" alt="" className="brand-logo" />
          <div>
            <h1>{t("app.title")}</h1>
            <p className="tagline">{t("app.tagline")}</p>
          </div>
        </div>
        <TabNav active={tab} onChange={setTab} />
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <section className="content">
        {tab === "discover" && (
          <>
            <div className="toolbar">
              <input
                ref={searchInputRef}
                className="search"
                value={query}
                placeholder={t("search.placeholder")}
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
            </div>
            {showFeatured ? (
              <FeaturedGrid
                installedIds={installedIds}
                busyIds={busyIds}
                onInstall={(id) => handleAction("install", id)}
              />
            ) : searchState === "loading" ? (
              <div className="empty">{t("search.loading")}</div>
            ) : (
              <PackageList
                packages={searchResults}
                action="install"
                busyIds={busyIds}
                emptyMessage={t("search.empty.none")}
                onAction={(a, id) =>
                  installedIds.has(id)
                    ? handleAction("uninstall", id)
                    : handleAction(a as "install", id)
                }
              />
            )}
          </>
        )}

        {tab === "installed" && (
          <>
            <div className="toolbar">
              <button
                className="btn"
                onClick={loadInstalled}
                disabled={installedState === "loading"}
              >
                {installedState === "loading" ? t("installed.loading") : t("installed.refresh")}
              </button>
              <span className="counter">{t("installed.count", { n: installed.length })}</span>
            </div>
            <PackageList
              packages={installed}
              action="uninstall"
              busyIds={busyIds}
              emptyMessage={t("installed.empty")}
              onAction={(_, id) => handleAction("uninstall", id)}
            />
          </>
        )}

        {tab === "updates" && (
          <>
            <div className="toolbar">
              <button
                className="btn"
                onClick={loadUpgradable}
                disabled={upgradableState === "loading"}
              >
                {upgradableState === "loading" ? t("installed.loading") : t("updates.refresh")}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpgradeAll}
                disabled={busyIds.has("*") || upgradable.length === 0}
              >
                {busyIds.has("*") ? t("updates.upgradingAll") : t("updates.upgradeAll")}
              </button>
              <span className="counter">{t("updates.count", { n: upgradable.length })}</span>
            </div>
            <PackageList
              packages={upgradable}
              action="upgrade"
              busyIds={busyIds}
              emptyMessage={t("updates.empty")}
              onAction={(_, id) => handleAction("upgrade", id)}
            />
          </>
        )}
      </section>

      <LogPanel lines={logLines} onClear={() => setLogLines([])} />
    </main>
  );
}

export default App;
