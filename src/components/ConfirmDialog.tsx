import { useState } from "react";
import { t } from "../i18n";
import { Modal } from "./Modal";

export interface ConfirmRequest {
  title: string;
  body: string;
  items?: string[];
  confirmLabel?: string;
  destructive?: boolean;
  /** Optional opt-in rendered under the body (e.g. "also scan for leftovers"). */
  checkbox?: { label: string; defaultChecked?: boolean };
  onConfirm: (checkboxChecked: boolean) => void;
}

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(request.checkbox?.defaultChecked ?? false);

  const confirm = () => {
    request.onConfirm(checked);
    onClose();
  };

  return (
    <Modal
      title={request.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("action.cancel")}
          </button>
          <button
            type="button"
            className={`btn ${request.destructive ? "btn-uninstall-solid" : "btn-primary"}`}
            onClick={confirm}
          >
            {request.confirmLabel ?? t("action.confirm")}
          </button>
        </>
      }
    >
      <p>{request.body}</p>
      {request.items && request.items.length > 0 && (
        <ul className="confirm-list">
          {request.items.slice(0, 12).map((item) => (
            <li key={item}>{item}</li>
          ))}
          {request.items.length > 12 && <li>… +{request.items.length - 12}</li>}
        </ul>
      )}
      {request.checkbox && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.currentTarget.checked)}
          />
          {request.checkbox.label}
        </label>
      )}
    </Modal>
  );
}
