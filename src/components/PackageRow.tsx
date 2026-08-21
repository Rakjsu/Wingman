import { memo, useState } from "react";
import { t } from "../i18n";
import type { Package } from "../lib/types";
import { IconCopy, IconExternal, IconInfo, IconPin, IconStar, IconX } from "./Icons";
import { PackageIcon } from "./PackageIcon";

export type RowAction = "install" | "uninstall" | "upgrade";

export interface RowState {
  busy: boolean;
  queued: boolean;
  percent: number | null;
  installed: boolean;
  favorite: boolean;
  pinned: boolean;
  selected?: boolean;
}

const BUSY_LABEL = {
  install: "action.installing",
  uninstall: "action.uninstalling",
  upgrade: "action.upgrading",
} as const;

const IDLE_LABEL = {
  install: "action.install",
  uninstall: "action.uninstall",
  upgrade: "action.upgrade",
} as const;

function PackageRowInner({
  pkg,
  action,
  state,
  selectable,
  showPin,
  onAction,
  onCancel,
  onToggleFavorite,
  onTogglePin,
  onToggleSelect,
  onDetails,
  onCopyId,
  onOpenHomepage,
}: {
  pkg: Package;
  action: RowAction;
  state: RowState;
  selectable?: boolean;
  showPin?: boolean;
  onAction: (action: RowAction, pkg: Package) => void;
  onCancel: (pkg: Package) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onDetails: (pkg: Package) => void;
  onCopyId?: (id: string) => void;
  onOpenHomepage?: (pkg: Package) => void;
}) {
  const { busy, queued, percent, installed, favorite, pinned, selected } = state;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const displayName = pkg.name || pkg.id;
  const matchedOn = pkg.matchedOn ?? pkg.matched_on ?? null;
  const isInstallBlocked = action === "install" && installed;

  return (
    <div
      className={`row ${busy ? "is-busy" : ""} ${selected ? "is-selected" : ""}`}
      onContextMenu={(event) => {
        if (!onCopyId) return;
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {selectable && onToggleSelect && (
        <input
          type="checkbox"
          className="row-check"
          checked={Boolean(selected)}
          onChange={() => onToggleSelect(pkg.id)}
          aria-label={t("a11y.selectPackage", { name: displayName })}
        />
      )}

      <PackageIcon name={displayName} id={pkg.id} />

      <div className="row-main">
        <div className="row-title">
          <span className="row-name" title={displayName}>
            {displayName}
          </span>
          {pinned && (
            <span className="chip chip-muted">
              <IconPin /> {t("updates.pinned")}
            </span>
          )}
          {queued && !busy && (
            <span className="chip chip-ghost">{t("queue.waiting")}</span>
          )}
          {matchedOn && <span className="chip chip-ghost">{matchedOn}</span>}
        </div>

        <div className="row-meta">
          <code className="row-id" title={pkg.id}>
            {pkg.id}
          </code>
          <span className="row-version">
            {pkg.version}
            {pkg.available && (
              <>
                <span className="row-arrow" aria-hidden="true">
                  →
                </span>
                <strong>{pkg.available}</strong>
              </>
            )}
          </span>
          {pkg.source && <span className="row-source">{pkg.source}</span>}
        </div>

        {busy && (
          <div
            className="row-progress"
            role="progressbar"
            aria-label={t("a11y.progress", { name: displayName })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
          >
            <div
              className={`row-progress-fill ${percent === null ? "is-indeterminate" : ""}`}
              style={percent !== null ? { width: `${percent}%` } : undefined}
            />
          </div>
        )}
      </div>

      <div
        className="row-actions"
        role="group"
        aria-label={t("a11y.rowActions", { name: displayName })}
      >
        <button
          type="button"
          className={`icon-btn ${favorite ? "is-on" : ""}`}
          onClick={() => onToggleFavorite(pkg.id)}
          aria-pressed={favorite}
          title={favorite ? t("favorites.remove") : t("favorites.add")}
        >
          <IconStar filled={favorite} />
          <span className="sr-only">
            {favorite ? t("favorites.remove") : t("favorites.add")}
          </span>
        </button>

        {showPin && onTogglePin && (
          <button
            type="button"
            className={`icon-btn ${pinned ? "is-on" : ""}`}
            onClick={() => onTogglePin(pkg.id)}
            aria-pressed={pinned}
            title={pinned ? t("updates.unpin") : t("updates.pin")}
          >
            <IconPin />
            <span className="sr-only">
              {pinned ? t("updates.unpin") : t("updates.pin")}
            </span>
          </button>
        )}

        <button
          type="button"
          className="icon-btn"
          onClick={() => onDetails(pkg)}
          title={t("action.details")}
        >
          <IconInfo />
          <span className="sr-only">{t("action.details")}</span>
        </button>

        {busy ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onCancel(pkg)}
            title={t("action.cancel")}
          >
            <IconX />
            <span>{t("action.cancel")}</span>
          </button>
        ) : (
          <button
            type="button"
            className={`btn btn-${action}`}
            disabled={isInstallBlocked || queued}
            onClick={() => onAction(action, pkg)}
          >
            {isInstallBlocked
              ? t("action.installed")
              : queued
                ? t("queue.waiting")
                : t(IDLE_LABEL[action])}
          </button>
        )}
      </div>

      {menu && onCopyId && (
        <>
          <div className="menu-scrim" onClick={() => setMenu(null)} />
          <ul className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCopyId(pkg.id);
                  setMenu(null);
                }}
              >
                <IconCopy /> {t("action.copyId")}
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onDetails(pkg);
                  setMenu(null);
                }}
              >
                <IconInfo /> {t("action.details")}
              </button>
            </li>
            {onOpenHomepage && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenHomepage(pkg);
                    setMenu(null);
                  }}
                >
                  <IconExternal /> {t("action.homepage")}
                </button>
              </li>
            )}
          </ul>
        </>
      )}

      {busy && (
        <span className="sr-only" aria-live="polite">
          {t(BUSY_LABEL[action])}
          {/* Announce milestones only; every frame would flood a screen reader. */}
          {percent !== null && percent % 25 === 0 ? ` ${percent}%` : ""}
        </span>
      )}
    </div>
  );
}

export const PackageRow = memo(PackageRowInner);
