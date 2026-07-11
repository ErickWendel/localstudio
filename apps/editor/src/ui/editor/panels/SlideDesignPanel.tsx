import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { SlideDesignBackgroundControls } from './slide-design/slideDesignBackgroundControls';
import { SlideLayoutChooser } from './slide-design/SlideLayoutChooser';
import { getSlideDesignLayoutOptions } from './slide-design/slideDesignLayoutOptions';
import type { SlideDesignPanelProps } from './slide-design/slideDesignPanelTypes';

export function SlideDesignPanel({
  page,
  project,
  onApplySlideLayout,
  onEditSlideLayout,
  onToggleSlideLayoutPlaceholder,
  onUpdatePageBackground,
}: SlideDesignPanelProps) {
  const layout = page?.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  const layoutOptions = getSlideDesignLayoutOptions(project);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const layoutId = layout?.id ?? layoutOptions[0]?.id;
  const layoutName = layout?.name ?? 'Blank';
  const visibility = layout?.placeholderVisibility ?? {
    body: true,
    footer: true,
    slideNumber: true,
    title: true,
  };
  return (
    <div className="panel-stack">
      <PanelSection title="Slide">
        <button
          aria-expanded={layoutPickerOpen}
          aria-label={`Open layout picker, current layout ${layoutName}`}
          className="template-preview-card template-preview-card-slide template-preview-button"
          type="button"
          onClick={() => setLayoutPickerOpen((current) => !current)}
        >
          <div className="template-slide-thumbnail" aria-hidden="true">
            <span className="template-slide-title" />
            <span className="template-slide-body" />
            <span className="template-slide-footer" />
          </div>
          <div className="template-preview-copy">
            <span>Slide layout</span>
            <strong>{layoutName}</strong>
          </div>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {layoutPickerOpen ? (
          <SlideLayoutChooser
            activeLayoutId={layout?.id}
            layouts={layoutOptions}
            pageId={page?.id}
            onApplySlideLayout={(pageId, nextLayoutId) => {
              onApplySlideLayout?.(pageId, nextLayoutId);
              setLayoutPickerOpen(false);
            }}
          />
        ) : null}
        <div className="template-action-row">
          <button
            type="button"
            disabled={!layoutId}
            onClick={() => layoutId && onEditSlideLayout?.(layoutId)}
          >
            Edit layout
          </button>
          <button
            type="button"
            disabled={!layoutId || !page}
            onClick={() => page && layoutId && onApplySlideLayout?.(page.id, layoutId)}
          >
            Apply layout
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Appearance">
        {(
          [
            ['title', 'Title'],
            ['body', 'Body'],
            ['footer', 'Footer'],
            ['slideNumber', 'Slide number'],
          ] as const
        ).map(([role, label]) => (
          <label className="template-checkbox-row" key={role}>
            <input
              checked={visibility[role]}
              disabled={!layoutId}
              type="checkbox"
              onChange={(event) => {
                if (layoutId) onToggleSlideLayoutPlaceholder?.(layoutId, role, event.target.checked);
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </PanelSection>

      <PanelSection title="Background">
        <SlideDesignBackgroundControls
          background={page?.background}
          onUpdatePageBackground={onUpdatePageBackground}
        />
      </PanelSection>
    </div>
  );
}
