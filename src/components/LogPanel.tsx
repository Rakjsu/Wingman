import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef } from "react";
import { t } from "../i18n";
import { api } from "../lib/api";
import { IconCopy, IconExternal, IconTrash, IconX } from "./Icons";

export interface LogLine {
  id: number;
  text: string;
  isError: boolean;
}

const LINE_HEIGHT = 19;

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

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 20,
    getItemKey: (index) => lines[index]?.id ?? index,
  });

  // Follow the tail unless the user scrolled up to read something.
  useLayoutEffect(() => {
    if (pinnedToBottom.current && lines.length > 0) {
      virtualizer.scrollToIndex(lines.length - 1, { align: "end" });
    }
  }, [lines.length, virtualizer]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.map((l) => l.text).join("\n"));
      onCopied();
    } catch (error) {
      console.warn("wingman: clipboard unavailable", error);
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

      <div className="logpanel-body" ref={bodyRef} tabIndex={0}>
        {lines.length === 0 ? (
          <p className="muted logpanel-empty">{t("log.empty")}</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((item) => {
              const line = lines[item.index];
              if (!line) return null;
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className={`logline ${line.isError ? "is-error" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
