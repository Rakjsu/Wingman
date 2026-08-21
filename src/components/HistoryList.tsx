import { t } from "../i18n";
import type { HistoryEntry } from "../lib/types";
import { IconAlert, IconCheck, IconTrash } from "./Icons";
import { EmptyState } from "./Feedback";

const ACTION_LABEL: Record<string, string> = {
  install: "action.install",
  uninstall: "action.uninstall",
  upgrade: "action.upgrade",
  "upgrade-all": "updates.upgradeAll",
  import: "installed.import",
};

export function HistoryList({
  entries,
  onClear,
}: {
  entries: HistoryEntry[];
  onClear: () => void;
}) {
  if (entries.length === 0) {
    return <EmptyState icon="🕑" title={t("history.empty")} />;
  }

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          <IconTrash /> {t("history.clear")}
        </button>
      </div>
      <ul className="history">
        {entries.map((entry) => (
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
                {t((ACTION_LABEL[entry.action] ?? "action.install") as never)} ·{" "}
                {new Date(entry.at).toLocaleString()}
              </span>
            </div>
            <span className={`chip ${entry.ok ? "chip-ok" : "chip-fail"}`}>
              {entry.ok ? t("history.succeeded") : t("history.failed")}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
