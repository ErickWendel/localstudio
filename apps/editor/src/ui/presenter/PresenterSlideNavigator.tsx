import type { Page } from '../../domain/documents/model';

export function PresenterSlideNavigator({
  onActivateSlide,
  onClose,
  onSelectSlide,
  pages,
  selectedIndex,
}: {
  onActivateSlide: (index: number) => void;
  onClose: () => void;
  onSelectSlide: (index: number) => void;
  pages: Page[];
  selectedIndex: number;
}) {
  function activateSlide(index: number) {
    onActivateSlide(index);
    onClose();
  }

  return (
    <div className="presentation-slide-navigator" role="dialog" aria-modal="true" aria-label="Slide navigator">
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
        {pages.map((page, index) => (
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
            onClick={() => onSelectSlide(index)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              activateSlide(index);
            }}
            onDoubleClick={() => activateSlide(index)}
          >
            <span>Slide {index + 1}</span>
            <strong>{page.name}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
