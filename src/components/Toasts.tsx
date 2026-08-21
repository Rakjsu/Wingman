import { t } from "../i18n";
import type { Toast } from "../hooks/useToasts";
import { IconAlert, IconCheck, IconInfo, IconX } from "./Icons";

const ICONS = {
  success: IconCheck,
  error: IconAlert,
  info: IconInfo,
} as const;

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toasts" role="region" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <Icon className="toast-icon" />
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onDismiss(toast.id)}
              title={t("action.dismiss")}
            >
              <IconX />
              <span className="sr-only">{t("action.dismiss")}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
