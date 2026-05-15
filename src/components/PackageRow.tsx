import { t } from "../i18n";
import type { Package } from "../hooks/useWinget";

export type RowAction = "install" | "uninstall" | "upgrade";

const LABEL_KEY: Record<RowAction, "action.install" | "action.uninstall" | "action.upgrade"> = {
  install: "action.install",
  uninstall: "action.uninstall",
  upgrade: "action.upgrade",
};

export function PackageRow({
  pkg,
  action,
  busy,
  onAction,
}: {
  pkg: Package;
  action: RowAction;
  busy: boolean;
  onAction: (action: RowAction, id: string) => void;
}) {
  return (
    <div className="row-pkg">
      <div className="pkg-info">
        <div className="pkg-name">{pkg.name || pkg.id}</div>
        <div className="pkg-meta">
          <span className="pkg-id">{pkg.id}</span>
          <span className="pkg-ver">
            {pkg.version}
            {pkg.available ? ` → ${pkg.available}` : ""}
          </span>
          {pkg.source && <span className="pkg-source">{pkg.source}</span>}
        </div>
      </div>
      <button
        className={`btn btn-${action}`}
        disabled={busy}
        onClick={() => onAction(action, pkg.id)}
      >
        {busy ? "…" : t(LABEL_KEY[action])}
      </button>
    </div>
  );
}
