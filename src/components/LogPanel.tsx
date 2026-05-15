import { useEffect, useRef } from "react";
import { t } from "../i18n";

export function LogPanel({ lines, onClear }: { lines: string[]; onClear: () => void }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);
  if (lines.length === 0) return null;
  return (
    <div className="log-panel">
      <div className="log-header">
        <span>{t("log.label")}</span>
        <button className="btn-link" onClick={onClear}>
          {t("log.clear")}
        </button>
      </div>
      <pre ref={ref}>{lines.join("\n")}</pre>
    </div>
  );
}
