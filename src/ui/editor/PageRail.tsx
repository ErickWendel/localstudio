import { ImagePlus, Plus } from 'lucide-react';
import type { ProjectDocument } from '../../domain/model';
import { IconButton } from '../components/IconButton';

interface PageRailProps {
  project: ProjectDocument;
  activePageId: string;
}

export function PageRail({ project, activePageId }: PageRailProps) {
  return (
    <aside className="page-rail" aria-label="Slide deck">
      <div className="rail-actions">
        <IconButton label="Import image">
          <ImagePlus size={16} />
        </IconButton>
        <IconButton label="Add slide">
          <Plus size={16} />
        </IconButton>
      </div>
      <div className="slide-list">
        {project.pages.map((page, index) => (
          <button
            key={page.id}
            className={page.id === activePageId ? 'slide-thumb slide-thumb-active' : 'slide-thumb'}
            type="button"
            aria-label={page.name}
          >
            <span className="slide-number">{index + 1}</span>
            <span className="slide-preview" />
            <span className="slide-name">{page.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
