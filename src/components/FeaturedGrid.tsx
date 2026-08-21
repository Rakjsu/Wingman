import { currentLang, t } from "../i18n";
import { FEATURED_CATEGORIES, type FeaturedPackage } from "../data/featured";
import { IconCheck, IconStar } from "./Icons";
import { PackageIcon } from "./PackageIcon";

export function FeaturedGrid({
  installedIds,
  busyIds,
  favorites,
  favoriteEntries,
  onInstall,
  onToggleFavorite,
}: {
  installedIds: Set<string>;
  busyIds: Set<string>;
  favorites: Set<string>;
  favoriteEntries: FeaturedPackage[];
  onInstall: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const lang = currentLang();

  const card = (pkg: FeaturedPackage) => {
    const installed = installedIds.has(pkg.id);
    const busy = busyIds.has(pkg.id);
    const favorite = favorites.has(pkg.id);
    return (
      <article className="card" key={pkg.id}>
        <header className="card-head">
          <PackageIcon name={pkg.name} id={pkg.id} size={32} />
          <button
            type="button"
            className={`icon-btn card-star ${favorite ? "is-on" : ""}`}
            onClick={() => onToggleFavorite(pkg.id)}
            aria-pressed={favorite}
            title={favorite ? t("favorites.remove") : t("favorites.add")}
          >
            <IconStar filled={favorite} />
            <span className="sr-only">
              {favorite ? t("favorites.remove") : t("favorites.add")}
            </span>
          </button>
        </header>
        <h3 className="card-name">{pkg.name}</h3>
        <p className="card-publisher">{pkg.publisher}</p>
        <p className="card-blurb">{pkg.blurb}</p>
        <button
          type="button"
          className={`btn ${installed ? "btn-ghost" : "btn-install"} card-action`}
          disabled={installed || busy}
          onClick={() => onInstall(pkg.id)}
        >
          {installed ? (
            <>
              <IconCheck /> {t("action.installed")}
            </>
          ) : busy ? (
            t("action.installing")
          ) : (
            t("action.install")
          )}
        </button>
      </article>
    );
  };

  return (
    <div className="featured">
      {favoriteEntries.length > 0 && (
        <section className="featured-section" aria-labelledby="featured-favorites">
          <h2 className="section-title" id="featured-favorites">
            {t("favorites.title")}
          </h2>
          <div className="grid">{favoriteEntries.map(card)}</div>
        </section>
      )}

      <section className="featured-section" aria-labelledby="featured-heading">
        <h2 className="section-title" id="featured-heading">
          {t("featured.title")}
        </h2>
        <p className="section-subtitle">{t("featured.subtitle")}</p>

        {FEATURED_CATEGORIES.map((category) => (
          <div className="featured-category" key={category.key}>
            <h3 className="category-title">
              {lang === "pt" ? category.labelPt : category.labelEn}
            </h3>
            <div className="grid">{category.packages.map(card)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
