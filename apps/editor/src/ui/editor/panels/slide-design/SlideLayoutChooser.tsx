import { SlideLayoutThumbnail } from './SlideLayoutThumbnail';
import type { SlideLayoutChooserProps } from './slideDesignPanelTypes';

export function SlideLayoutChooser({
  activeLayoutId,
  layouts,
  pageId,
  onApplySlideLayout,
}: SlideLayoutChooserProps) {
  return (
    <div className="template-chooser-shelf" aria-label="Choose a layout" role="region">
      <div className="template-chooser-title">Choose a layout</div>
      {layouts.length > 0 ? (
        <div className="layout-choice-grid">
          {layouts.map((layout) => (
            <button
              aria-current={layout.id === activeLayoutId ? 'true' : undefined}
              className={
                layout.id === activeLayoutId
                  ? 'layout-choice-card layout-choice-card-active'
                  : 'layout-choice-card'
              }
              disabled={!pageId}
              key={layout.id}
              type="button"
              onClick={() => {
                if (pageId) onApplySlideLayout(pageId, layout.id);
              }}
            >
              <SlideLayoutThumbnail layout={layout} />
              <span>{layout.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="template-chooser-empty">No imported layouts yet.</p>
      )}
    </div>
  );
}
