import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { api } from "../lib/api";
import { IconCopy, IconExternal, IconTrash, IconX } from "./Icons";

export interface LogLine {
  id: number;
  text: string;
  isError: boolean;
}

export function LogPanel({
  lines,
  onClear,
  onClose,
  onCopied,
}: {
  lines: LogLine[];
  onClear: () => void;
  onClose: () => void;
  onCopied: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Only autoscroll when the user has not scrolled up to read something.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && pinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.map((l) => l.text).join("\n"));
      onCopied();
    } catch {
      // Clipboard can be blocked; the log is still on screen and on disk.
    }
  };

  return (
    <section className="logpanel" aria-label={t("log.title")}>
      <header className="logpanel-head">
        <span className="logpanel-title">{t("log.title")}</span>
        <div className="logpanel-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            <IconCopy /> {t("log.copy")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void api.openLogDir()}
          >
            <IconExternal /> {t("log.open")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
            <IconTrash /> {t("log.clear")}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title={t("log.hide")}
          >
            <IconX />
            <span className="sr-only">{t("log.hide")}</span>
          </button>
        </div>
      </header>
      <div className="logpanel-body" ref={bodyRef} onScroll={onScroll} tabIndex={0}>
        {lines.length === 0 ? (
          <p className="muted logpanel-empty">{t("log.empty")}</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`logline ${line.isError ? "is-error" : ""}`}>
              {line.text}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
