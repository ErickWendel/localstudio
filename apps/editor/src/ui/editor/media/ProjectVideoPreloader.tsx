import type { ProjectDocument } from '../../../domain/documents/model';

interface ProjectVideoPreloaderProps {
  project: ProjectDocument;
}

export function ProjectVideoPreloader({ project }: ProjectVideoPreloaderProps) {
  const videoAssets = Object.values(project.assets).filter(
    (asset) => asset.type === 'video' && asset.objectUrl,
  );
  if (videoAssets.length === 0) return null;

  return (
    <div className="project-video-preloader" aria-hidden="true">
      {videoAssets.map((asset) => (
        <video
          key={asset.id}
          muted
          playsInline
          preload="auto"
          src={asset.objectUrl}
        />
      ))}
    </div>
  );
}
