import { useMemo, useState } from "react";
import { formatDateTime, formatRelative, t, type TKey } from "../i18n";
import type { HistoryEntry } from "../lib/types";
import { EmptyState } from "./Feedback";
import { IconAlert, IconCheck, IconRefresh, IconSearch, IconTrash } from "./Icons";

const ACTION_LABEL: Record<string, TKey> = {
  install: "action.install",
  uninstall: "action.uninstall",
  upgrade: "action.upgrade",
  "upgrade-all": "updates.upgradeAll",
  import: "installed.import",
};

export function HistoryList({
  entries,
  onClear,
  onReinstall,
}: {
  entries: HistoryEntry[];
  onClear: () => void;
  onReinstall: (id: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [onlyFailures, setOnlyFailures] = useState(false);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return entries.filter((entry) => {
      if (onlyFailures && entry.ok) return false;
      if (!needle) return true;
      return entry.id.toLowerCase().includes(needle);
    });
  }, [entries, filter, onlyFailures]);

  if (entries.length === 0) {
    return <EmptyState icon="🕑" title={t("history.empty")} />;
  }

  return (
    <>
      <div className="toolbar">
        <div className="search-wrap search-wrap-sm">
          <IconSearch className="search-icon" />
          <input
            className="search"
            type="search"
            value={filter}
            placeholder={t("history.filter")}
            aria-label={t("history.filter")}
            onChange={(e) => setFilter(e.currentTarget.value)}
          />
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={onlyFailures}
            onChange={(e) => setOnlyFailures(e.currentTarget.checked)}
          />
          {t("history.onlyFailures")}
        </label>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          <IconTrash /> {t("history.clear")}
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🔍" title={t("history.empty")} />
      ) : (
        <ul className="history">
          {visible.map((entry) => (
            <li key={`${entry.at}-${entry.id}`} className="history-item">
              <span
                className={`history-status ${entry.ok ? "is-ok" : "is-fail"}`}
                aria-hidden="true"
              >
                {entry.ok ? <IconCheck /> : <IconAlert />}
              </span>
              <div className="history-main">
                <span className="history-id">{entry.id === "*" ? "—" : entry.id}</span>
                <span className="history-meta">
                  {t(ACTION_LABEL[entry.action] ?? "action.install")} ·{" "}
                  <time
                    dateTime={new Date(entry.at).toISOString()}
                    title={formatDateTime(entry.at)}
                  >
                    {formatRelative(entry.at)}
                  </time>
                </span>
              </div>
              {entry.id !== "*" && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onReinstall(entry.id)}
                >
                  <IconRefresh /> {t("history.reinstall")}
                </button>
              )}
              <span className={`chip ${entry.ok ? "chip-ok" : "chip-fail"}`}>
                {entry.ok ? t("history.succeeded") : t("history.failed")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
