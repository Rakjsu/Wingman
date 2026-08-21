export interface FeaturedPackage {
  id: string;
  name: string;
  publisher: string;
  blurb: string;
}

export interface FeaturedCategory {
  /** i18n-independent key; the label is resolved at render time. */
  key: string;
  labelEn: string;
  labelPt: string;
  packages: FeaturedPackage[];
}

export const FEATURED_CATEGORIES: FeaturedCategory[] = [
  {
    key: "browsers",
    labelEn: "Browsers",
    labelPt: "Navegadores",
    packages: [
      {
        id: "Brave.Brave",
        name: "Brave",
        publisher: "Brave Software",
        blurb: "Privacy-first browser",
      },
      {
        id: "Mozilla.Firefox",
        name: "Firefox",
        publisher: "Mozilla",
        blurb: "Independent and open",
      },
      {
        id: "Google.Chrome",
        name: "Chrome",
        publisher: "Google",
        blurb: "The usual suspect",
      },
      {
        id: "VivaldiTechnologies.Vivaldi",
        name: "Vivaldi",
        publisher: "Vivaldi",
        blurb: "Endlessly customisable",
      },
    ],
  },
  {
    key: "dev",
    labelEn: "Development",
    labelPt: "Desenvolvimento",
    packages: [
      {
        id: "Microsoft.VisualStudioCode",
        name: "Visual Studio Code",
        publisher: "Microsoft",
        blurb: "Modern code editor",
      },
      { id: "Git.Git", name: "Git", publisher: "Git Project", blurb: "Version control" },
      {
        id: "OpenJS.NodeJS.LTS",
        name: "Node.js LTS",
        publisher: "OpenJS Foundation",
        blurb: "JavaScript runtime",
      },
      {
        id: "Python.Python.3.12",
        name: "Python 3.12",
        publisher: "Python Software Foundation",
        blurb: "Batteries included",
      },
      {
        id: "Microsoft.WindowsTerminal",
        name: "Windows Terminal",
        publisher: "Microsoft",
        blurb: "A terminal worth using",
      },
      {
        id: "Docker.DockerDesktop",
        name: "Docker Desktop",
        publisher: "Docker",
        blurb: "Containers locally",
      },
    ],
  },
  {
    key: "media",
    labelEn: "Media",
    labelPt: "Mídia",
    packages: [
      {
        id: "VideoLAN.VLC",
        name: "VLC media player",
        publisher: "VideoLAN",
        blurb: "Plays everything",
      },
      {
        id: "OBSProject.OBSStudio",
        name: "OBS Studio",
        publisher: "OBS Project",
        blurb: "Record and stream",
      },
      {
        id: "Audacity.Audacity",
        name: "Audacity",
        publisher: "Audacity Team",
        blurb: "Audio editing",
      },
      { id: "GIMP.GIMP.3", name: "GIMP", publisher: "GIMP Team", blurb: "Image editing" },
    ],
  },
  {
    key: "productivity",
    labelEn: "Productivity",
    labelPt: "Produtividade",
    packages: [
      {
        id: "Obsidian.Obsidian",
        name: "Obsidian",
        publisher: "Obsidian",
        blurb: "Local-first notes",
      },
      {
        id: "Notion.Notion",
        name: "Notion",
        publisher: "Notion Labs",
        blurb: "Docs and databases",
      },
      {
        id: "7zip.7zip",
        name: "7-Zip",
        publisher: "Igor Pavlov",
        blurb: "File archiver",
      },
      {
        id: "Notepad++.Notepad++",
        name: "Notepad++",
        publisher: "Don Ho",
        blurb: "Quick text editing",
      },
    ],
  },
  {
    key: "communication",
    labelEn: "Communication",
    labelPt: "Comunicação",
    packages: [
      {
        id: "Discord.Discord",
        name: "Discord",
        publisher: "Discord Inc.",
        blurb: "Voice and text chat",
      },
      {
        id: "SlackTechnologies.Slack",
        name: "Slack",
        publisher: "Slack Technologies",
        blurb: "Team messaging",
      },
      { id: "Zoom.Zoom", name: "Zoom", publisher: "Zoom", blurb: "Video meetings" },
      {
        id: "Telegram.TelegramDesktop",
        name: "Telegram",
        publisher: "Telegram FZ-LLC",
        blurb: "Fast messaging",
      },
    ],
  },
];

export const FEATURED: FeaturedPackage[] = FEATURED_CATEGORIES.flatMap((c) => c.packages);

export function findFeatured(id: string): FeaturedPackage | undefined {
  return FEATURED.find((p) => p.id === id);
}
