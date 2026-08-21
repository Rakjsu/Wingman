export type Lang = "en" | "pt";

const en = {
  "app.title": "Wingman",
  "app.tagline": "A friendly GUI for winget",

  "nav.discover": "Discover",
  "nav.installed": "Installed",
  "nav.updates": "Updates",
  "nav.history": "History",
  "nav.section.library": "Library",
  "nav.section.activity": "Activity",

  "search.placeholder": "Search packages…",
  "search.hint": "Type at least 2 characters",
  "search.loading": "Searching…",
  "search.results": "{n} results",
  "search.empty": "No packages matched “{q}”.",
  "search.clear": "Clear search",

  "featured.title": "Popular packages",
  "featured.subtitle": "Hand-picked starting points",
  "favorites.title": "Your favorites",
  "favorites.add": "Add to favorites",
  "favorites.remove": "Remove from favorites",
  "favorites.empty": "Star a package to pin it here.",

  "installed.refresh": "Refresh",
  "installed.empty": "Nothing installed through winget yet.",
  "installed.count": "{n} installed",
  "installed.filter": "Filter installed…",
  "installed.export": "Export list",
  "installed.import": "Import list",
  "installed.selected": "{n} selected",
  "installed.uninstallSelected": "Uninstall selected",
  "installed.clearSelection": "Clear selection",

  "updates.refresh": "Check again",
  "updates.upgradeAll": "Update all",
  "updates.upgradingAll": "Updating all…",
  "updates.empty": "Everything is up to date.",
  "updates.count": "{n} available",
  "updates.pin": "Skip in “Update all”",
  "updates.unpin": "Include in “Update all”",
  "updates.pinned": "Skipped",

  "history.empty": "No operations yet.",
  "history.clear": "Clear history",
  "history.succeeded": "Succeeded",
  "history.failed": "Failed",

  "sort.label": "Sort",
  "sort.name": "Name",
  "sort.id": "Identifier",
  "sort.source": "Source",
  "source.label": "Source",
  "source.all": "All sources",

  "action.install": "Install",
  "action.installing": "Installing…",
  "action.uninstall": "Uninstall",
  "action.uninstalling": "Removing…",
  "action.upgrade": "Update",
  "action.upgrading": "Updating…",
  "action.installed": "Installed",
  "action.cancel": "Cancel",
  "action.details": "Details",
  "action.copyId": "Copy identifier",
  "action.homepage": "Open homepage",
  "action.retry": "Try again",
  "action.dismiss": "Dismiss",
  "action.close": "Close",
  "action.confirm": "Confirm",

  "confirm.uninstall.title": "Remove {name}?",
  "confirm.uninstall.body":
    "This uninstalls the package from your computer. It can be reinstalled later from Discover.",
  "confirm.uninstallMany.title": "Remove {n} packages?",
  "confirm.uninstallMany.body": "These packages will be uninstalled one after another:",
  "confirm.upgradeAll.title": "Update {n} packages?",
  "confirm.upgradeAll.body": "Wingman will update the following packages:",
  "confirm.import.title": "Import this list?",
  "confirm.import.body":
    "Every package in the file that is not already installed will be installed.",

  "details.title": "Package details",
  "details.publisher": "Publisher",
  "details.version": "Version",
  "details.license": "License",
  "details.homepage": "Homepage",
  "details.description": "Description",
  "details.versions": "Available versions",
  "details.loading": "Loading details…",
  "details.installVersion": "Install this version",

  "log.title": "Activity log",
  "log.show": "Show log",
  "log.hide": "Hide log",
  "log.clear": "Clear",
  "log.copy": "Copy",
  "log.copied": "Log copied",
  "log.open": "Open log folder",
  "log.empty": "Nothing logged yet.",

  "theme.label": "Theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",

  "toast.installed": "{name} installed",
  "toast.uninstalled": "{name} removed",
  "toast.upgraded": "{name} updated",
  "toast.upgradedAll": "All packages updated",
  "toast.cancelled": "Operation cancelled",
  "toast.exported": "List exported",
  "toast.imported": "List imported",
  "toast.copied": "Copied to clipboard",
  "toast.updatesAvailable": "{n} updates available",

  "error.title": "Something went wrong",
  "error.NotInstalled": "winget was not found on this computer.",
  "error.Unsupported": "Your winget is too old for Wingman.",
  "error.NotFound": "That package could not be found.",
  "error.NeedsElevation": "This operation needs administrator rights.",
  "error.SourceBusy": "winget is busy with another operation. Try again shortly.",
  "error.Network": "Network problem while reaching the package source.",
  "error.HashMismatch": "The installer failed its integrity check and was not run.",
  "error.NoApplicableInstaller": "No installer for this package matches your system.",
  "error.NoUpdateAvailable": "There is no newer version to install.",
  "error.Cancelled": "The operation was cancelled.",
  "error.Timeout": "winget took too long to respond.",
  "error.InvalidId": "That package identifier is not valid.",
  "error.CommandFailed": "winget reported an error.",
  "error.Io": "Could not talk to winget.",

  "elevate.title": "Administrator rights needed",
  "elevate.body":
    "Windows requires elevation to change this package. Wingman can restart with administrator rights.",
  "elevate.action": "Restart as administrator",
  "elevate.later": "Not now",

  "onboarding.title": "winget is required",
  "onboarding.body":
    "Wingman is a front-end for the Windows Package Manager. Install “App Installer” from the Microsoft Store, then reopen Wingman.",
  "onboarding.action": "Open Microsoft Store",
  "onboarding.retry": "I installed it — check again",
  "onboarding.outdated":
    "Wingman needs winget {minimum} or newer, but found {found}. Update “App Installer” from the Microsoft Store.",

  "a11y.mainNav": "Main sections",
  "a11y.packageList": "Package list",
  "a11y.rowActions": "Actions for {name}",
  "a11y.progress": "Installation progress for {name}",
  "a11y.busy": "Working",
  "a11y.selectPackage": "Select {name}",

  "shortcut.hint": "Ctrl+F search · Ctrl+1/2/3 sections · Esc close",
} as const;

export type TKey = keyof typeof en;

const pt: Record<TKey, string> = {
  "app.title": "Wingman",
  "app.tagline": "Uma interface amigável para o winget",

  "nav.discover": "Descobrir",
  "nav.installed": "Instalados",
  "nav.updates": "Atualizações",
  "nav.history": "Histórico",
  "nav.section.library": "Biblioteca",
  "nav.section.activity": "Atividade",

  "search.placeholder": "Buscar pacotes…",
  "search.hint": "Digite ao menos 2 caracteres",
  "search.loading": "Buscando…",
  "search.results": "{n} resultados",
  "search.empty": "Nenhum pacote encontrado para “{q}”.",
  "search.clear": "Limpar busca",

  "featured.title": "Pacotes populares",
  "featured.subtitle": "Bons pontos de partida",
  "favorites.title": "Seus favoritos",
  "favorites.add": "Adicionar aos favoritos",
  "favorites.remove": "Remover dos favoritos",
  "favorites.empty": "Marque um pacote com estrela para fixá-lo aqui.",

  "installed.refresh": "Atualizar",
  "installed.empty": "Nada instalado pelo winget ainda.",
  "installed.count": "{n} instalados",
  "installed.filter": "Filtrar instalados…",
  "installed.export": "Exportar lista",
  "installed.import": "Importar lista",
  "installed.selected": "{n} selecionados",
  "installed.uninstallSelected": "Desinstalar selecionados",
  "installed.clearSelection": "Limpar seleção",

  "updates.refresh": "Verificar de novo",
  "updates.upgradeAll": "Atualizar tudo",
  "updates.upgradingAll": "Atualizando tudo…",
  "updates.empty": "Tudo em dia.",
  "updates.count": "{n} disponíveis",
  "updates.pin": "Ignorar em “Atualizar tudo”",
  "updates.unpin": "Incluir em “Atualizar tudo”",
  "updates.pinned": "Ignorado",

  "history.empty": "Nenhuma operação ainda.",
  "history.clear": "Limpar histórico",
  "history.succeeded": "Concluído",
  "history.failed": "Falhou",

  "sort.label": "Ordenar",
  "sort.name": "Nome",
  "sort.id": "Identificador",
  "sort.source": "Fonte",
  "source.label": "Fonte",
  "source.all": "Todas as fontes",

  "action.install": "Instalar",
  "action.installing": "Instalando…",
  "action.uninstall": "Desinstalar",
  "action.uninstalling": "Removendo…",
  "action.upgrade": "Atualizar",
  "action.upgrading": "Atualizando…",
  "action.installed": "Instalado",
  "action.cancel": "Cancelar",
  "action.details": "Detalhes",
  "action.copyId": "Copiar identificador",
  "action.homepage": "Abrir site",
  "action.retry": "Tentar de novo",
  "action.dismiss": "Dispensar",
  "action.close": "Fechar",
  "action.confirm": "Confirmar",

  "confirm.uninstall.title": "Remover {name}?",
  "confirm.uninstall.body":
    "Isso desinstala o pacote do seu computador. Dá para reinstalar depois pela aba Descobrir.",
  "confirm.uninstallMany.title": "Remover {n} pacotes?",
  "confirm.uninstallMany.body": "Estes pacotes serão desinstalados um após o outro:",
  "confirm.upgradeAll.title": "Atualizar {n} pacotes?",
  "confirm.upgradeAll.body": "O Wingman vai atualizar os seguintes pacotes:",
  "confirm.import.title": "Importar esta lista?",
  "confirm.import.body":
    "Todo pacote do arquivo que ainda não estiver instalado será instalado.",

  "details.title": "Detalhes do pacote",
  "details.publisher": "Publicador",
  "details.version": "Versão",
  "details.license": "Licença",
  "details.homepage": "Site",
  "details.description": "Descrição",
  "details.versions": "Versões disponíveis",
  "details.loading": "Carregando detalhes…",
  "details.installVersion": "Instalar esta versão",

  "log.title": "Log de atividade",
  "log.show": "Mostrar log",
  "log.hide": "Esconder log",
  "log.clear": "Limpar",
  "log.copy": "Copiar",
  "log.copied": "Log copiado",
  "log.open": "Abrir pasta de logs",
  "log.empty": "Nada registrado ainda.",

  "theme.label": "Tema",
  "theme.light": "Claro",
  "theme.dark": "Escuro",
  "theme.system": "Sistema",

  "toast.installed": "{name} instalado",
  "toast.uninstalled": "{name} removido",
  "toast.upgraded": "{name} atualizado",
  "toast.upgradedAll": "Todos os pacotes atualizados",
  "toast.cancelled": "Operação cancelada",
  "toast.exported": "Lista exportada",
  "toast.imported": "Lista importada",
  "toast.copied": "Copiado para a área de transferência",
  "toast.updatesAvailable": "{n} atualizações disponíveis",

  "error.title": "Algo deu errado",
  "error.NotInstalled": "O winget não foi encontrado neste computador.",
  "error.Unsupported": "Seu winget é antigo demais para o Wingman.",
  "error.NotFound": "Esse pacote não foi encontrado.",
  "error.NeedsElevation": "Esta operação precisa de direitos de administrador.",
  "error.SourceBusy":
    "O winget está ocupado com outra operação. Tente de novo em instantes.",
  "error.Network": "Problema de rede ao acessar a fonte de pacotes.",
  "error.HashMismatch":
    "O instalador falhou na verificação de integridade e não foi executado.",
  "error.NoApplicableInstaller":
    "Nenhum instalador deste pacote serve para o seu sistema.",
  "error.NoUpdateAvailable": "Não há versão mais nova para instalar.",
  "error.Cancelled": "A operação foi cancelada.",
  "error.Timeout": "O winget demorou demais para responder.",
  "error.InvalidId": "Esse identificador de pacote não é válido.",
  "error.CommandFailed": "O winget relatou um erro.",
  "error.Io": "Não foi possível falar com o winget.",

  "elevate.title": "Precisa de administrador",
  "elevate.body":
    "O Windows exige elevação para alterar este pacote. O Wingman pode reiniciar com direitos de administrador.",
  "elevate.action": "Reiniciar como administrador",
  "elevate.later": "Agora não",

  "onboarding.title": "O winget é necessário",
  "onboarding.body":
    "O Wingman é uma interface para o Windows Package Manager. Instale o “Instalador de Aplicativo” pela Microsoft Store e reabra o Wingman.",
  "onboarding.action": "Abrir a Microsoft Store",
  "onboarding.retry": "Já instalei — verificar de novo",
  "onboarding.outdated":
    "O Wingman precisa do winget {minimum} ou mais novo, mas encontrou {found}. Atualize o “Instalador de Aplicativo” pela Microsoft Store.",

  "a11y.mainNav": "Seções principais",
  "a11y.packageList": "Lista de pacotes",
  "a11y.rowActions": "Ações para {name}",
  "a11y.progress": "Progresso da instalação de {name}",
  "a11y.busy": "Processando",
  "a11y.selectPackage": "Selecionar {name}",

  "shortcut.hint": "Ctrl+F buscar · Ctrl+1/2/3 seções · Esc fechar",
};

const dictionaries: Record<Lang, Record<TKey, string>> = { en, pt };

function detectLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  return nav.toLowerCase().startsWith("pt") ? "pt" : "en";
}

let lang: Lang = detectLang();

export function setLang(next: Lang) {
  lang = next;
}

export function currentLang(): Lang {
  return lang;
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  let s: string = dictionaries[lang]?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
