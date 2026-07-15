import { createAppServices } from './app/composition';
import { PublicDeckViewer } from './ui/share/PublicDeckViewer';

interface PublicDeckAppProps {
  embed: boolean;
  shareId: string;
}

export function PublicDeckApp({ embed, shareId }: PublicDeckAppProps) {
  const services = createAppServices();
  return (
    <PublicDeckViewer
      shareId={shareId}
      fontImportService={services.fontImportService}
      shareService={services.shareService}
      embed={embed}
    />
  );
}
