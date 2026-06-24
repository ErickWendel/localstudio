import { useRef } from 'react';
import type { ProjectDocument } from '../../domain/model';

interface PageRailProps {
  project: ProjectDocument;
  activePageId: string;
  onImportImage?: (file: File) => void;
}

export function PageRail({ project, activePageId, onImportImage }: PageRailProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="page-rail" aria-label="Slide deck">
      <div className="slide-list">
        {project.pages.map((page, index) => (
          <div
            key={page.id}
            className={page.id === activePageId ? 'slide-item slide-item-active' : 'slide-item'}
          >
            <button
              className="slide-thumb"
              type="button"
              aria-label={page.name}
              title={page.name}
            >
              {page.id === activePageId ? <span className="slide-preview slide-preview-active" /> : null}
              {page.id !== activePageId ? (
                <span className="slide-empty-icon material-symbols-outlined">horizontal_rule</span>
              ) : null}
            </button>
            <span className="slide-number">{index + 1}</span>
          </div>
        ))}
      </div>
      <div className="rail-actions">
        <button className="rail-action-button" title="Add Page" type="button" aria-label="Add Page">
          <span className="material-symbols-outlined">note_add</span>
          <span>Add</span>
        </button>
        <button
          className="rail-action-button"
          title="Import Assets"
          type="button"
          aria-label="Import Assets"
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          <span className="material-symbols-outlined">add_photo_alternate</span>
          <span>Import</span>
        </button>
        <input
          ref={fileInputRef}
          aria-label="Import image file"
          className="visually-hidden-input"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onImportImage?.(file);
            event.target.value = '';
          }}
        />
      </div>
    </aside>
  );
}
