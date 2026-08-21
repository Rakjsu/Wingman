import { t } from "../i18n";
import { Modal } from "./Modal";

const SHORTCUTS: { keys: string[]; labelKey: Parameters<typeof t>[0] }[] = [
  { keys: ["Ctrl", "F"], labelKey: "shortcuts.search" },
  { keys: ["Ctrl", "K"], labelKey: "shortcuts.search" },
  { keys: ["Ctrl", "1 – 4"], labelKey: "shortcuts.sections" },
  { keys: ["Esc"], labelKey: "shortcuts.close" },
  { keys: ["?"], labelKey: "shortcuts.help" },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={t("shortcuts.title")} onClose={onClose}>
      <dl className="shortcuts">
        {SHORTCUTS.map(({ keys, labelKey }) => (
          <div className="shortcut" key={keys.join("+")}>
            <dt>
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{t(labelKey)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
