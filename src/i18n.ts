type Lang = "en" | "pt";

const translations = {
  en: {
    "app.title": "Wingman",
    "app.tagline": "A friendly GUI for winget",
    "tab.discover": "Discover",
    "tab.installed": "Installed",
    "tab.updates": "Updates",
    "search.placeholder": "Search packages (min. 2 chars)…",
    "search.loading": "Searching…",
    "search.empty.short": "Type at least 2 characters to search.",
    "search.empty.none": "No packages found.",
    "featured.title": "Popular packages",
    "installed.refresh": "Refresh list",
    "installed.loading": "Loading…",
    "installed.empty": "Nothing installed via winget.",
    "installed.count": "{n} packages",
    "updates.refresh": "Refresh list",
    "updates.upgradeAll": "Upgrade all",
    "updates.upgradingAll": "Upgrading all…",
    "updates.empty": "Everything up to date.",
    "updates.count": "{n} available",
    "action.install": "Install",
    "action.uninstall": "Uninstall",
    "action.upgrade": "Upgrade",
    "log.label": "Log",
    "log.clear": "clear",
  },
  pt: {
    "app.title": "Wingman",
    "app.tagline": "Uma GUI amigável para o winget",
    "tab.discover": "Descobrir",
    "tab.installed": "Instalados",
    "tab.updates": "Atualizações",
    "search.placeholder": "Buscar pacote (mín. 2 caracteres)…",
    "search.loading": "Buscando…",
    "search.empty.short": "Digite ao menos 2 caracteres para buscar.",
    "search.empty.none": "Nenhum pacote encontrado.",
    "featured.title": "Pacotes populares",
    "installed.refresh": "Atualizar lista",
    "installed.loading": "Carregando…",
    "installed.empty": "Nada instalado via winget.",
    "installed.count": "{n} pacotes",
    "updates.refresh": "Atualizar lista",
    "updates.upgradeAll": "Atualizar tudo",
    "updates.upgradingAll": "Atualizando tudo…",
    "updates.empty": "Tudo em dia.",
    "updates.count": "{n} disponíveis",
    "action.install": "Instalar",
    "action.uninstall": "Desinstalar",
    "action.upgrade": "Atualizar",
    "log.label": "Log",
    "log.clear": "limpar",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TKey = keyof (typeof translations)["en"];

function detectLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  return nav.toLowerCase().startsWith("pt") ? "pt" : "en";
}

const lang: Lang = detectLang();

export function t(key: TKey, vars?: Record<string, string | number>): string {
  const dict = translations[lang] ?? translations.en;
  let s = dict[key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export function currentLang(): Lang {
  return lang;
}
