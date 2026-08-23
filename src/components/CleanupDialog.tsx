import { useMemo, useState } from "react";
import { t, type TKey } from "../i18n";
import { api } from "../lib/api";
import { errorMessage, toWingetError } from "../lib/errors";
import type {
  CleanItemResult,
  LeftoverItem,
  LeftoverKind,
  LeftoverReason,
} from "../lib/types";
import { IconAlert, IconBox, IconCheck, IconTerminal, IconTrash } from "./Icons";
import { Modal } from "./Modal";

export interface CleanupRequest {
  packageId: string;
  packageName: string;
  items: LeftoverItem[];
  elevated: boolean;
}

const KIND_LABEL: Record<LeftoverKind, TKey> = {
  folder: "cleanup.kind.folder",
  registryKey: "cleanup.kind.registryKey",
  registryValue: "cleanup.kind.registryValue",
  shortcut: "cleanup.kind.shortcut",
};

const KIND_ORDER: LeftoverKind[] = ["folder", "shortcut", "registryKey", "registryValue"];

const REASON_LABEL: Record<LeftoverReason, TKey> = {
  installLocation: "cleanup.reason.installLocation",
  nameMatch: "cleanup.reason.nameMatch",
  publisherOnly: "cleanup.reason.publisherOnly",
  arpLeftover: "cleanup.reason.arpLeftover",
  runKey: "cleanup.reason.runKey",
  shortcutMatch: "cleanup.reason.shortcutMatch",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function CleanupDialog({
  request,
  onClose,
  onNeedsElevation,
  onToast,
}: {
  request: CleanupRequest;
  onClose: () => void;
  onNeedsElevation: () => void;
  onToast: (message: string, tone: "success" | "error" | "info") => void;
}) {
  const { items } = request;
  const [selected, setSelected] = useState<Set<string>>(
    // High-confidence findings start checked; "possible" matches start off.
    () => new Set(items.filter((i) => i.confidence === "high").map((i) => i.id)),
  );
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Map<string, CleanItemResult> | null>(null);
  const [backupDir, setBackupDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        items: items.filter((i) => i.kind === kind),
      })).filter((g) => g.items.length > 0),
    [items],
  );

  const selectedSize = useMemo(
    () =>
      items
        .filter((i) => selected.has(i.id) && i.sizeBytes !== null)
        .reduce((sum, i) => sum + (i.sizeBytes ?? 0), 0),
    [items, selected],
  );

  const anySelectedNeedsAdmin = useMemo(
    () => !request.elevated && items.some((i) => selected.has(i.id) && i.requiresAdmin),
    [items, selected, request.elevated],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // A dismiss that lands while a deletion is in flight would pop this dialog
  // off the queue and then let the resolving promise close the *next* one too.
  const closeIfIdle = () => {
    if (!busy) onClose();
  };

  const removeSelected = async () => {
    setBusy(true);
    setError(null);
    let closed = false;
    try {
      const result = await api.cleanLeftovers(request.packageId, [...selected]);
      const map = new Map(result.results.map((r) => [r.id, r]));
      setResults(map);
      setBackupDir(result.backupDir);

      const failed = result.results.filter((r) => !r.ok);
      const removed = result.results.length - failed.length;
      if (failed.length === 0) {
        // Name the backup in the toast: the note inside the dialog is
        // unreachable once it closes, and that note is the only place the
        // promised recovery path appears.
        onToast(
          result.backupDir
            ? `${t("cleanup.done", { n: removed })} · ${t("cleanup.backupAt", { path: result.backupDir })}`
            : t("cleanup.done", { n: removed }),
          "success",
        );
        closed = true;
        onClose();
      } else {
        onToast(t("cleanup.partial", { n: removed, m: failed.length }), "info");
        if (failed.some((r) => r.needsAdmin)) onNeedsElevation();
      }
    } catch (e) {
      setError(errorMessage(toWingetError(e)));
    } finally {
      if (!closed) setBusy(false);
    }
  };

  return (
    <Modal
      title={t("cleanup.title", { name: request.packageName })}
      onClose={closeIfIdle}
      wide
      footer={
        <>
          <span className="cleanup-total">
            {selected.size > 0 &&
              t("cleanup.selectedSummary", {
                n: selected.size,
                size: formatBytes(selectedSize),
              })}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={closeIfIdle}
          >
            {results ? t("action.close") : t("cleanup.skip")}
          </button>
          <button
            type="button"
            className="btn btn-uninstall-solid"
            aria-disabled={busy || selected.size === 0}
            aria-busy={busy}
            onClick={() => {
              if (busy || selected.size === 0) return;
              void removeSelected();
            }}
          >
            <IconTrash />
            {busy
              ? t("cleanup.removing")
              : t("cleanup.removeSelected", { n: selected.size })}
          </button>
        </>
      }
    >
      <p>{t("cleanup.subtitle")}</p>
      <p className="cleanup-note">
        <IconBox /> {t("cleanup.recycleNote")}
      </p>
      {anySelectedNeedsAdmin && (
        <p className="cleanup-warn">
          <IconAlert /> {t("cleanup.adminWarning")}
        </p>
      )}
      {error && <p className="details-error">{error}</p>}

      {grouped.map(({ kind, items: groupItems }) => (
        <section className="cleanup-group" key={kind}>
          <h4>{t(KIND_LABEL[kind])}</h4>
          <ul className="cleanup-list">
            {groupItems.map((item) => {
              const result = results?.get(item.id);
              return (
                <li key={item.id} className="cleanup-item">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    disabled={busy || result?.ok === true}
                    onChange={() => toggle(item.id)}
                    aria-label={item.path}
                  />
                  <div className="cleanup-item-main">
                    <code className="cleanup-path" title={item.path}>
                      {item.path}
                    </code>
                    <span className="cleanup-meta">
                      {t(REASON_LABEL[item.reason])}
                      {item.sizeBytes !== null && ` · ${formatBytes(item.sizeBytes)}`}
                      {item.requiresAdmin &&
                        !request.elevated &&
                        ` · ${t("cleanup.requiresAdmin")}`}
                      {item.confidence === "medium" && ` · ${t("cleanup.possibleMatch")}`}
                    </span>
                    {result && !result.ok && (
                      <span className="cleanup-fail">
                        <IconAlert /> {result.error ?? t("error.title")}
                      </span>
                    )}
                  </div>
                  {result?.ok && (
                    <span className="cleanup-ok">
                      <IconCheck />
                      <span className="sr-only">{t("history.succeeded")}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {backupDir && (
        <p className="cleanup-note">
          <IconTerminal /> {t("cleanup.backupAt", { path: backupDir })}
        </p>
      )}
    </Modal>
  );
}
