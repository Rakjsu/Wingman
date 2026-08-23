import { useEffect, useId, useRef, type ReactNode } from "react";
import { t } from "../i18n";
import { IconX } from "./Icons";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: labelled, focus-trapped, Escape-dismissable, and it
 * restores focus to whatever opened it.
 */
export function Modal({
  title,
  children,
  footer,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const backdropPressed = useRef(false);
  // Callers pass an inline arrow, so `onClose` has a new identity on every
  // parent render. Reading it through a ref keeps it out of the effect's deps:
  // otherwise the effect tears down and re-runs on unrelated re-renders,
  // yanking focus back to the first control and corrupting the restore target.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreRef.current?.focus?.();
    };
  }, []);

  return (
    <div
      className="overlay"
      // Only a press that both starts and ends on the backdrop counts as a
      // dismiss; otherwise dragging a text selection out of the dialog closes it.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) backdropPressed.current = true;
      }}
      onMouseUp={(event) => {
        if (backdropPressed.current && event.target === event.currentTarget) {
          onClose();
        }
        backdropPressed.current = false;
      }}
    >
      <div
        ref={panelRef}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title={t("action.close")}
          >
            <IconX />
            <span className="sr-only">{t("action.close")}</span>
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
