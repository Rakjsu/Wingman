import { t } from "../i18n";
import { Modal } from "./Modal";

export interface ConfirmRequest {
  title: string;
  body: string;
  items?: string[];
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose: () => void;
}) {
  const confirm = () => {
    request.onConfirm();
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
    </Modal>
  );
}
