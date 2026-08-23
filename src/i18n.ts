export type Lang = "en" | "pt" | "es";

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
  "search.results": "{n} result|{n} results",
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
  "installed.count": "{n} installed|{n} installed",
  "installed.filter": "Filter installed…",
  "installed.export": "Export list",
  "installed.import": "Import list",
  "installed.selected": "{n} selected|{n} selected",
  "installed.uninstallSelected": "Uninstall selected",
  "installed.clearSelection": "Clear selection",

  "updates.refresh": "Check again",
  "updates.upgradeAll": "Update all",
  "updates.upgradingAll": "Updating all…",
  "updates.empty": "Everything is up to date.",
  "updates.count": "{n} available|{n} available",
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
  "confirm.uninstallMany.title": "Remove {n} package?|Remove {n} packages?",
  "confirm.uninstallMany.body": "These packages will be uninstalled one after another:",
  "confirm.upgradeAll.title": "Update {n} package?|Update {n} packages?",
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
  "toast.updatesAvailable": "{n} update available|{n} updates available",

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

  "lang.label": "Language",
  "shortcuts.title": "Keyboard shortcuts",
  "shortcuts.open": "Keyboard shortcuts",
  "shortcuts.search": "Focus search",
  "shortcuts.sections": "Switch section",
  "shortcuts.close": "Close dialog or dismiss error",
  "shortcuts.help": "Show this help",
  "history.filter": "Filter history…",
  "history.onlyFailures": "Failures only",
  "history.reinstall": "Install again",
  "sort.direction": "Reverse order",
  "a11y.skip": "Skip to content",
  "queue.waiting": "Queued",
  "error.InvalidQuery": "That search query is not valid.",
  "toast.copiedId": "Identifier copied",
  "confirm.cancel.title": "Stop installing {name}?",
  "confirm.cancel.body":
    "It is already {percent}% done. Stopping now may leave a partial install behind.",
  "confirm.cancel.action": "Stop it",
  "import.skipped": "Packages unavailable in your sources were skipped.",

  "cleanup.option": "Also look for leftovers afterwards (folders, registry, shortcuts)",
  "cleanup.title": "Leftovers from {name}",
  "cleanup.subtitle":
    "The uninstaller finished, but these traces are still on your system. Review the list and remove what you do not want to keep.",
  "cleanup.none": "No leftovers found for {name}.",
  "cleanup.recycleNote":
    "Folders and shortcuts go to the Recycle Bin. Registry keys are exported to a backup file before removal.",
  "cleanup.adminWarning":
    "Some selected items need administrator rights and may fail until Wingman is restarted as administrator.",
  "cleanup.kind.folder": "Folders",
  "cleanup.kind.registryKey": "Registry keys",
  "cleanup.kind.registryValue": "Startup entries",
  "cleanup.kind.shortcut": "Shortcuts",
  "cleanup.reason.installLocation": "The folder the app installed into",
  "cleanup.reason.nameMatch": "Name matches the app",
  "cleanup.reason.publisherOnly": "Publisher folder holding only this app",
  "cleanup.reason.arpLeftover": "Dangling entry in installed programs",
  "cleanup.reason.runKey": "Autostart entry pointing at the removed app",
  "cleanup.reason.shortcutMatch": "Shortcut named after the app",
  "cleanup.requiresAdmin": "needs administrator",
  "cleanup.possibleMatch": "possible match",
  "cleanup.selectedSummary": "{n} selected · {size}",
  "cleanup.removeSelected": "Remove selected ({n})",
  "cleanup.removing": "Removing…",
  "cleanup.skip": "Keep everything",
  "cleanup.done": "{n} leftover removed|{n} leftovers removed",
  "cleanup.partial": "Removed: {n} · Failed: {m}",
  "cleanup.backupAt": "Registry backup saved to {path}",
  "cleanup.scanning": "Checking for leftovers…",
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
  "search.results": "{n} resultado|{n} resultados",
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
  "installed.count": "{n} instalado|{n} instalados",
  "installed.filter": "Filtrar instalados…",
  "installed.export": "Exportar lista",
  "installed.import": "Importar lista",
  "installed.selected": "{n} selecionado|{n} selecionados",
  "installed.uninstallSelected": "Desinstalar selecionados",
  "installed.clearSelection": "Limpar seleção",

  "updates.refresh": "Verificar de novo",
  "updates.upgradeAll": "Atualizar tudo",
  "updates.upgradingAll": "Atualizando tudo…",
  "updates.empty": "Tudo em dia.",
  "updates.count": "{n} disponível|{n} disponíveis",
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
  "confirm.uninstallMany.title": "Remover {n} pacote?|Remover {n} pacotes?",
  "confirm.uninstallMany.body": "Estes pacotes serão desinstalados um após o outro:",
  "confirm.upgradeAll.title": "Atualizar {n} pacote?|Atualizar {n} pacotes?",
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
  "toast.updatesAvailable": "{n} atualização disponível|{n} atualizações disponíveis",

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

  "lang.label": "Idioma",
  "shortcuts.title": "Atalhos de teclado",
  "shortcuts.open": "Atalhos de teclado",
  "shortcuts.search": "Focar a busca",
  "shortcuts.sections": "Trocar de seção",
  "shortcuts.close": "Fechar diálogo ou dispensar erro",
  "shortcuts.help": "Mostrar esta ajuda",
  "history.filter": "Filtrar histórico…",
  "history.onlyFailures": "Somente falhas",
  "history.reinstall": "Instalar de novo",
  "sort.direction": "Inverter ordem",
  "a11y.skip": "Pular para o conteúdo",
  "queue.waiting": "Na fila",
  "error.InvalidQuery": "Essa busca não é válida.",
  "toast.copiedId": "Identificador copiado",
  "confirm.cancel.title": "Parar a instalação de {name}?",
  "confirm.cancel.body":
    "Já está em {percent}%. Parar agora pode deixar uma instalação pela metade.",
  "confirm.cancel.action": "Parar",
  "import.skipped": "Pacotes indisponíveis nas suas fontes foram pulados.",

  "cleanup.option": "Procurar sobras depois (pastas, registro, atalhos)",
  "cleanup.title": "Sobras de {name}",
  "cleanup.subtitle":
    "A desinstalação terminou, mas estes rastros continuam no sistema. Revise a lista e remova o que não quiser manter.",
  "cleanup.none": "Nenhuma sobra encontrada de {name}.",
  "cleanup.recycleNote":
    "Pastas e atalhos vão para a Lixeira. Chaves de registro são exportadas para um arquivo de backup antes da remoção.",
  "cleanup.adminWarning":
    "Alguns itens selecionados precisam de administrador e podem falhar até o Wingman reiniciar como administrador.",
  "cleanup.kind.folder": "Pastas",
  "cleanup.kind.registryKey": "Chaves de registro",
  "cleanup.kind.registryValue": "Entradas de inicialização",
  "cleanup.kind.shortcut": "Atalhos",
  "cleanup.reason.installLocation": "A pasta onde o app foi instalado",
  "cleanup.reason.nameMatch": "Nome corresponde ao app",
  "cleanup.reason.publisherOnly": "Pasta do fabricante contendo só este app",
  "cleanup.reason.arpLeftover": "Entrada órfã em programas instalados",
  "cleanup.reason.runKey": "Entrada de inicialização apontando para o app removido",
  "cleanup.reason.shortcutMatch": "Atalho com o nome do app",
  "cleanup.requiresAdmin": "precisa de administrador",
  "cleanup.possibleMatch": "correspondência possível",
  "cleanup.selectedSummary": "{n} selecionados · {size}",
  "cleanup.removeSelected": "Remover selecionados ({n})",
  "cleanup.removing": "Removendo…",
  "cleanup.skip": "Manter tudo",
  "cleanup.done": "{n} sobra removida|{n} sobras removidas",
  "cleanup.partial": "Removidos: {n} · Falharam: {m}",
  "cleanup.backupAt": "Backup do registro salvo em {path}",
  "cleanup.scanning": "Verificando sobras…",
};

const es: Record<TKey, string> = {
  "app.title": "Wingman",
  "app.tagline": "Una interfaz amigable para winget",

  "nav.discover": "Descubrir",
  "nav.installed": "Instalados",
  "nav.updates": "Actualizaciones",
  "nav.history": "Historial",
  "nav.section.library": "Biblioteca",
  "nav.section.activity": "Actividad",

  "search.placeholder": "Buscar paquetes…",
  "search.hint": "Escribe al menos 2 caracteres",
  "search.loading": "Buscando…",
  "search.results": "{n} resultado|{n} resultados",
  "search.empty": "Ningún paquete coincide con “{q}”.",
  "search.clear": "Limpiar búsqueda",

  "featured.title": "Paquetes populares",
  "featured.subtitle": "Buenos puntos de partida",
  "favorites.title": "Tus favoritos",
  "favorites.add": "Añadir a favoritos",
  "favorites.remove": "Quitar de favoritos",
  "favorites.empty": "Marca un paquete con una estrella para fijarlo aquí.",

  "installed.refresh": "Actualizar",
  "installed.empty": "Todavía no hay nada instalado con winget.",
  "installed.count": "{n} instalado|{n} instalados",
  "installed.filter": "Filtrar instalados…",
  "installed.export": "Exportar lista",
  "installed.import": "Importar lista",
  "installed.selected": "{n} seleccionado|{n} seleccionados",
  "installed.uninstallSelected": "Desinstalar seleccionados",
  "installed.clearSelection": "Limpiar selección",

  "updates.refresh": "Comprobar de nuevo",
  "updates.upgradeAll": "Actualizar todo",
  "updates.upgradingAll": "Actualizando todo…",
  "updates.empty": "Todo está al día.",
  "updates.count": "{n} disponible|{n} disponibles",
  "updates.pin": "Omitir en “Actualizar todo”",
  "updates.unpin": "Incluir en “Actualizar todo”",
  "updates.pinned": "Omitido",

  "history.empty": "Aún no hay operaciones.",
  "history.clear": "Limpiar historial",
  "history.succeeded": "Correcto",
  "history.failed": "Falló",

  "sort.label": "Ordenar",
  "sort.name": "Nombre",
  "sort.id": "Identificador",
  "sort.source": "Fuente",
  "source.label": "Fuente",
  "source.all": "Todas las fuentes",

  "action.install": "Instalar",
  "action.installing": "Instalando…",
  "action.uninstall": "Desinstalar",
  "action.uninstalling": "Quitando…",
  "action.upgrade": "Actualizar",
  "action.upgrading": "Actualizando…",
  "action.installed": "Instalado",
  "action.cancel": "Cancelar",
  "action.details": "Detalles",
  "action.copyId": "Copiar identificador",
  "action.homepage": "Abrir sitio web",
  "action.retry": "Reintentar",
  "action.dismiss": "Descartar",
  "action.close": "Cerrar",
  "action.confirm": "Confirmar",

  "confirm.uninstall.title": "¿Quitar {name}?",
  "confirm.uninstall.body":
    "Esto desinstala el paquete de tu equipo. Podrás reinstalarlo desde Descubrir.",
  "confirm.uninstallMany.title": "¿Quitar {n} paquete?|¿Quitar {n} paquetes?",
  "confirm.uninstallMany.body": "Estos paquetes se desinstalarán uno tras otro:",
  "confirm.upgradeAll.title": "¿Actualizar {n} paquete?|¿Actualizar {n} paquetes?",
  "confirm.upgradeAll.body": "Wingman actualizará los siguientes paquetes:",
  "confirm.import.title": "¿Importar esta lista?",
  "confirm.import.body":
    "Se instalará todo paquete del archivo que aún no esté instalado.",

  "details.title": "Detalles del paquete",
  "details.publisher": "Editor",
  "details.version": "Versión",
  "details.license": "Licencia",
  "details.homepage": "Sitio web",
  "details.description": "Descripción",
  "details.versions": "Versiones disponibles",
  "details.loading": "Cargando detalles…",
  "details.installVersion": "Instalar esta versión",

  "log.title": "Registro de actividad",
  "log.show": "Mostrar registro",
  "log.hide": "Ocultar registro",
  "log.clear": "Limpiar",
  "log.copy": "Copiar",
  "log.copied": "Registro copiado",
  "log.open": "Abrir carpeta de registros",
  "log.empty": "Nada registrado todavía.",

  "theme.label": "Tema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "theme.system": "Sistema",

  "toast.installed": "{name} instalado",
  "toast.uninstalled": "{name} eliminado",
  "toast.upgraded": "{name} actualizado",
  "toast.upgradedAll": "Todos los paquetes actualizados",
  "toast.cancelled": "Operación cancelada",
  "toast.exported": "Lista exportada",
  "toast.imported": "Lista importada",
  "toast.copied": "Copiado al portapapeles",
  "toast.updatesAvailable":
    "{n} actualización disponible|{n} actualizaciones disponibles",

  "error.title": "Algo salió mal",
  "error.NotInstalled": "No se encontró winget en este equipo.",
  "error.Unsupported": "Tu winget es demasiado antiguo para Wingman.",
  "error.NotFound": "No se encontró ese paquete.",
  "error.NeedsElevation": "Esta operación necesita permisos de administrador.",
  "error.SourceBusy": "winget está ocupado con otra operación. Inténtalo en un momento.",
  "error.Network": "Problema de red al contactar con la fuente de paquetes.",
  "error.HashMismatch":
    "El instalador no superó la comprobación de integridad y no se ejecutó.",
  "error.NoApplicableInstaller":
    "Ningún instalador de este paquete es compatible con tu sistema.",
  "error.NoUpdateAvailable": "No hay una versión más nueva para instalar.",
  "error.Cancelled": "La operación fue cancelada.",
  "error.Timeout": "winget tardó demasiado en responder.",
  "error.InvalidId": "Ese identificador de paquete no es válido.",
  "error.CommandFailed": "winget informó de un error.",
  "error.Io": "No se pudo comunicar con winget.",

  "elevate.title": "Se necesitan permisos de administrador",
  "elevate.body":
    "Windows exige elevación para cambiar este paquete. Wingman puede reiniciarse como administrador.",
  "elevate.action": "Reiniciar como administrador",
  "elevate.later": "Ahora no",

  "onboarding.title": "winget es obligatorio",
  "onboarding.body":
    "Wingman es una interfaz para el Administrador de paquetes de Windows. Instala “Instalador de aplicación” desde Microsoft Store y vuelve a abrir Wingman.",
  "onboarding.action": "Abrir Microsoft Store",
  "onboarding.retry": "Ya lo instalé — comprobar otra vez",
  "onboarding.outdated":
    "Wingman necesita winget {minimum} o posterior, pero encontró {found}. Actualiza “Instalador de aplicación” desde Microsoft Store.",

  "a11y.mainNav": "Secciones principales",
  "a11y.packageList": "Lista de paquetes",
  "a11y.rowActions": "Acciones para {name}",
  "a11y.progress": "Progreso de instalación de {name}",
  "a11y.busy": "Procesando",
  "a11y.selectPackage": "Seleccionar {name}",

  "shortcut.hint": "Ctrl+F buscar · Ctrl+1/2/3 secciones · Esc cerrar",

  "lang.label": "Idioma",
  "shortcuts.title": "Atajos de teclado",
  "shortcuts.open": "Atajos de teclado",
  "shortcuts.search": "Enfocar la búsqueda",
  "shortcuts.sections": "Cambiar de sección",
  "shortcuts.close": "Cerrar diálogo o descartar error",
  "shortcuts.help": "Mostrar esta ayuda",
  "history.filter": "Filtrar historial…",
  "history.onlyFailures": "Solo fallos",
  "history.reinstall": "Instalar de nuevo",
  "sort.direction": "Invertir orden",
  "a11y.skip": "Saltar al contenido",
  "queue.waiting": "En cola",
  "error.InvalidQuery": "Esa búsqueda no es válida.",
  "toast.copiedId": "Identificador copiado",
  "confirm.cancel.title": "¿Detener la instalación de {name}?",
  "confirm.cancel.body":
    "Ya va por el {percent}%. Detenerla ahora puede dejar una instalación a medias.",
  "confirm.cancel.action": "Detener",
  "import.skipped": "Se omitieron los paquetes no disponibles en tus fuentes.",

  "cleanup.option": "Buscar restos después (carpetas, registro, accesos directos)",
  "cleanup.title": "Restos de {name}",
  "cleanup.subtitle":
    "La desinstalación terminó, pero estos rastros siguen en el sistema. Revisa la lista y elimina lo que no quieras conservar.",
  "cleanup.none": "No se encontraron restos de {name}.",
  "cleanup.recycleNote":
    "Las carpetas y los accesos directos van a la Papelera. Las claves del registro se exportan a un archivo de copia antes de eliminarse.",
  "cleanup.adminWarning":
    "Algunos elementos seleccionados necesitan administrador y pueden fallar hasta reiniciar Wingman como administrador.",
  "cleanup.kind.folder": "Carpetas",
  "cleanup.kind.registryKey": "Claves del registro",
  "cleanup.kind.registryValue": "Entradas de inicio",
  "cleanup.kind.shortcut": "Accesos directos",
  "cleanup.reason.installLocation": "La carpeta donde se instaló la app",
  "cleanup.reason.nameMatch": "El nombre coincide con la app",
  "cleanup.reason.publisherOnly": "Carpeta del fabricante que solo contiene esta app",
  "cleanup.reason.arpLeftover": "Entrada huérfana en programas instalados",
  "cleanup.reason.runKey": "Entrada de inicio que apunta a la app eliminada",
  "cleanup.reason.shortcutMatch": "Acceso directo con el nombre de la app",
  "cleanup.requiresAdmin": "necesita administrador",
  "cleanup.possibleMatch": "coincidencia posible",
  "cleanup.selectedSummary": "{n} seleccionados · {size}",
  "cleanup.removeSelected": "Eliminar seleccionados ({n})",
  "cleanup.removing": "Eliminando…",
  "cleanup.skip": "Conservar todo",
  "cleanup.done": "{n} resto eliminado|{n} restos eliminados",
  "cleanup.partial": "Eliminados: {n} · Fallaron: {m}",
  "cleanup.backupAt": "Copia del registro guardada en {path}",
  "cleanup.scanning": "Buscando restos…",
};

export const dictionaries: Record<Lang, Record<TKey, string>> = { en, pt, es };

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
];

const STORAGE_KEY = "wingman.lang";

function detectLang(): Lang {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; fall back to the browser locale.
  }
  if (stored) {
    const parsed = stored.replaceAll('"', "");
    if (parsed in dictionaries) return parsed as Lang;
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  const lower = nav.toLowerCase();
  if (lower.startsWith("pt")) return "pt";
  if (lower.startsWith("es")) return "es";
  return "en";
}

let lang: Lang = detectLang();

/**
 * Changes the active language. Callers must also re-render — `t` is a plain
 * function, not a hook, so nothing subscribes to this on its own. `App` keeps
 * the language in state and remounts its subtree, which is what makes a switch
 * visible immediately.
 */
export function setLang(next: Lang) {
  lang = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not persisting a language preference is survivable.
  }
}

export function currentLang(): Lang {
  return lang;
}

/**
 * Look up a translated string.
 *
 * `count` triggers plural selection: a value of `{key}` may hold two forms
 * separated by `|` (singular first), chosen with `Intl.PluralRules` so each
 * language applies its own rules.
 */
export function t(key: TKey, vars?: Record<string, string | number>): string {
  let s: string = dictionaries[lang]?.[key] ?? en[key] ?? key;

  if (s.includes("|") && vars && typeof vars.n === "number") {
    const forms = s.split("|");
    const rule = new Intl.PluralRules(lang).select(vars.n);
    // Dictionaries carry "one|other"; anything else falls back to the last form.
    s = rule === "one" ? forms[0] : (forms[forms.length - 1] ?? forms[0]);
  }

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      const formatted =
        typeof v === "number" ? new Intl.NumberFormat(lang).format(v) : String(v);
      s = s.split(`{${k}}`).join(formatted);
    }
  }
  return s;
}

/** "2 minutes ago" in the active language. */
export function formatRelative(timestamp: number): string {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ];

  let value = seconds;
  for (const [unit, limit] of units) {
    if (Math.abs(value) < limit) {
      return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(
        Math.round(value),
        unit,
      );
    }
    value /= limit;
  }
  return new Date(timestamp).toLocaleString(lang);
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(lang, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Collator reused across sorts; constructing one per comparison is costly. */
let collatorLang: Lang = lang;
let collator = new Intl.Collator(lang, { sensitivity: "base", numeric: true });

export function compareStrings(a: string, b: string): number {
  if (collatorLang !== lang) {
    collatorLang = lang;
    collator = new Intl.Collator(lang, { sensitivity: "base", numeric: true });
  }
  return collator.compare(a, b);
}
