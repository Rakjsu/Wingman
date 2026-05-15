import { t } from "../i18n";

export type Tab = "discover" | "installed" | "updates";

const TABS: { key: Tab; labelKey: "tab.discover" | "tab.installed" | "tab.updates" }[] = [
  { key: "discover", labelKey: "tab.discover" },
  { key: "installed", labelKey: "tab.installed" },
  { key: "updates", labelKey: "tab.updates" },
];

export function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabnav">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab ${active === tab.key ? "active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </nav>
  );
}
