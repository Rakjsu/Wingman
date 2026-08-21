import { t } from "../i18n";
import type { ThemePreference } from "../hooks/useTheme";
import {
  IconArrowUp,
  IconBox,
  IconClock,
  IconGrid,
  IconMonitor,
  IconMoon,
  IconSun,
  IconTerminal,
} from "./Icons";

export type Section = "discover" | "installed" | "updates" | "history";

const SECTIONS: {
  key: Section;
  labelKey: "nav.discover" | "nav.installed" | "nav.updates" | "nav.history";
  Icon: typeof IconGrid;
  group: "library" | "activity";
}[] = [
  { key: "discover", labelKey: "nav.discover", Icon: IconGrid, group: "library" },
  { key: "installed", labelKey: "nav.installed", Icon: IconBox, group: "library" },
  { key: "updates", labelKey: "nav.updates", Icon: IconArrowUp, group: "library" },
  { key: "history", labelKey: "nav.history", Icon: IconClock, group: "activity" },
];

const THEMES: {
  key: ThemePreference;
  labelKey: "theme.light" | "theme.dark" | "theme.system";
  Icon: typeof IconSun;
}[] = [
  { key: "light", labelKey: "theme.light", Icon: IconSun },
  { key: "dark", labelKey: "theme.dark", Icon: IconMoon },
  { key: "system", labelKey: "theme.system", Icon: IconMonitor },
];

export function Sidebar({
  active,
  onChange,
  updateCount,
  installedCount,
  theme,
  onThemeChange,
  onToggleLog,
  logOpen,
  appVersion,
}: {
  active: Section;
  onChange: (section: Section) => void;
  updateCount: number;
  installedCount: number;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onToggleLog: () => void;
  logOpen: boolean;
  appVersion: string;
}) {
  const renderGroup = (group: "library" | "activity") => (
    <>
      <div className="nav-group-label" id={`nav-group-${group}`}>
        {t(group === "library" ? "nav.section.library" : "nav.section.activity")}
      </div>
      <ul className="nav-list" aria-labelledby={`nav-group-${group}`}>
        {SECTIONS.filter((s) => s.group === group).map(({ key, labelKey, Icon }) => {
          const badge =
            key === "updates" ? updateCount : key === "installed" ? installedCount : 0;
          return (
            <li key={key}>
              <button
                type="button"
                className={`nav-item ${active === key ? "is-active" : ""}`}
                aria-current={active === key ? "page" : undefined}
                onClick={() => onChange(key)}
              >
                <Icon className="nav-icon" />
                <span className="nav-label">{t(labelKey)}</span>
                {badge > 0 && (
                  <span className={`nav-badge ${key === "updates" ? "is-accent" : ""}`}>
                    {badge > 999 ? "999+" : badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/wingman.svg" alt="" className="brand-logo" width={32} height={32} />
        <div className="brand-text">
          <span className="brand-name">{t("app.title")}</span>
          <span className="brand-version">v{appVersion}</span>
        </div>
      </div>

      <nav className="nav" aria-label={t("a11y.mainNav")}>
        {renderGroup("library")}
        {renderGroup("activity")}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`nav-item nav-item-sm ${logOpen ? "is-active" : ""}`}
          onClick={onToggleLog}
          aria-pressed={logOpen}
        >
          <IconTerminal className="nav-icon" />
          <span className="nav-label">{logOpen ? t("log.hide") : t("log.show")}</span>
        </button>

        <div className="theme-switch" role="radiogroup" aria-label={t("theme.label")}>
          {THEMES.map(({ key, labelKey, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={theme === key}
              className={`theme-btn ${theme === key ? "is-active" : ""}`}
              title={t(labelKey)}
              onClick={() => onThemeChange(key)}
            >
              <Icon />
              <span className="sr-only">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
