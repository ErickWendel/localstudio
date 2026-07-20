import type { ProjectDocument } from '../../../domain/documents/model';

interface ProjectVideoPreloaderProps {
  project: ProjectDocument;
}

export function ProjectVideoPreloader({ project }: ProjectVideoPreloaderProps) {
  const mediaAssets = Object.values(project.assets).filter(
    (asset) => (asset.type === 'video' || asset.type === 'gif') && asset.objectUrl,
  );
  if (mediaAssets.length === 0) return null;

  return (
    <div className="project-video-preloader" aria-hidden="true">
      {mediaAssets.map((asset) =>
        asset.type === 'video' ? (
          <video
            key={asset.id}
            muted
            playsInline
            preload="auto"
            src={asset.objectUrl}
          />
        ) : (
          <img key={asset.id} alt="" src={asset.objectUrl} />
        ),
      )}
    </div>
  );
}
