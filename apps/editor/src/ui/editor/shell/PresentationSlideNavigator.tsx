import type { ProjectDocument } from '../../../domain/documents/model';

interface PresentationSlideNavigatorProps {
  project: ProjectDocument;
  selectedIndex: number;
  onClose: () => void;
  onPlayPageAt: (index: number) => void;
  onSelectIndex: (index: number) => void;
}

export function PresentationSlideNavigator({
  project,
  selectedIndex,
  onClose,
  onPlayPageAt,
  onSelectIndex,
}: PresentationSlideNavigatorProps) {
  return (
    <div
      className="presentation-slide-navigator"
      role="dialog"
      aria-modal="true"
      aria-label="Slide navigator"
    >
      <div className="presentation-slide-navigator-header">
        <h2>Slide Navigator</h2>
        <button
          className="stitch-icon-button"
          type="button"
          aria-label="Close slide navigator"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>
      <div className="presentation-slide-navigator-list" role="listbox" aria-label="Slides">
        {project.pages.map((page, index) => (
          <button
            aria-selected={index === selectedIndex}
            className={
              index === selectedIndex
                ? 'presentation-slide-navigator-item presentation-slide-navigator-item-active'
                : 'presentation-slide-navigator-item'
            }
            key={page.id}
            type="button"
            role="option"
            onClick={() => onSelectIndex(index)}
            onDoubleClick={() => onPlayPageAt(index)}
          >
            <span>Slide {index + 1}</span>
            <strong>{page.name}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
