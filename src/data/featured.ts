export interface FeaturedPackage {
  id: string;
  name: string;
  publisher: string;
  blurb: string;
}

export const FEATURED: FeaturedPackage[] = [
  { id: "Microsoft.VisualStudioCode", name: "Visual Studio Code", publisher: "Microsoft", blurb: "Modern code editor" },
  { id: "7zip.7zip", name: "7-Zip", publisher: "Igor Pavlov", blurb: "File archiver" },
  { id: "Git.Git", name: "Git", publisher: "Git Project", blurb: "Distributed version control" },
  { id: "Brave.Brave", name: "Brave", publisher: "Brave Software", blurb: "Privacy-first browser" },
  { id: "VideoLAN.VLC", name: "VLC media player", publisher: "VideoLAN", blurb: "Plays everything" },
  { id: "Notepad++.Notepad++", name: "Notepad++", publisher: "Don Ho", blurb: "Source code editor" },
];
