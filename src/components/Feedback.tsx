import type { ReactNode } from "react";
import { t } from "../i18n";
import { IconAlert } from "./Icons";

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label={t("a11y.busy")}>
      {Array.from({ length: rows }, (_, i) => (
        <div className="row skeleton-row" key={i}>
          <div className="skeleton skeleton-icon" />
          <div className="row-main">
            <div
              className="skeleton skeleton-line"
              style={{ width: `${45 + ((i * 7) % 30)}%` }}
            />
            <div
              className="skeleton skeleton-line skeleton-line-sm"
              style={{ width: `${25 + ((i * 11) % 25)}%` }}
            />
          </div>
          <div className="skeleton skeleton-btn" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ cards = 8 }: { cards?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label={t("a11y.busy")}>
      {Array.from({ length: cards }, (_, i) => (
        <div className="card skeleton-card" key={i}>
          <div className="skeleton skeleton-icon" />
          <div className="skeleton skeleton-line" style={{ width: "70%" }} />
          <div
            className="skeleton skeleton-line skeleton-line-sm"
            style={{ width: "45%" }}
          />
          <div className="skeleton skeleton-btn" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon ?? "📦"}
      </div>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="banner banner-error" role="alert" aria-live="assertive">
      <IconAlert className="banner-icon" />
      <div className="banner-text">
        <strong>{t("error.title")}</strong>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          {t("action.retry")}
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
        {t("action.dismiss")}
      </button>
    </div>
  );
}
