import { FEATURED } from "../data/featured";
import { t } from "../i18n";

export function FeaturedGrid({
  installedIds,
  busyIds,
  onInstall,
}: {
  installedIds: Set<string>;
  busyIds: Set<string>;
  onInstall: (id: string) => void;
}) {
  return (
    <div className="featured">
      <h2 className="featured-title">{t("featured.title")}</h2>
      <div className="featured-grid">
        {FEATURED.map((p) => {
          const installed = installedIds.has(p.id);
          const busy = busyIds.has(p.id);
          return (
            <div key={p.id} className="featured-card">
              <div className="featured-name">{p.name}</div>
              <div className="featured-pub">{p.publisher}</div>
              <div className="featured-blurb">{p.blurb}</div>
              <button
                className={`btn ${installed ? "btn-uninstall" : "btn-install"}`}
                disabled={busy || installed}
                onClick={() => onInstall(p.id)}
              >
                {installed ? "✓ " + t("action.install") : busy ? "…" : t("action.install")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
