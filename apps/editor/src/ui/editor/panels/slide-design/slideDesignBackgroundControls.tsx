import { DesignColorField } from '../design-controls/DesignColorField';
import { DesignSelectField } from '../design-controls/DesignSelectField';
import type { SlideDesignBackgroundControlsProps } from './slideDesignPanelTypes';

const slideFillTypeOptions = [{ value: 'color', label: 'Color fill' }] as const;

function getBackgroundColor(background: SlideDesignBackgroundControlsProps['background']) {
  if (!background) return '#050D10';
  return background.type === 'color' ? background.color : background.colorFallback;
}

export function SlideDesignBackgroundControls({
  background,
  onUpdatePageBackground,
}: SlideDesignBackgroundControlsProps) {
  return (
    <>
      <div className="template-segmented-control" role="group" aria-label="Background mode">
        <button className="template-segmented-active" type="button">
          Standard
        </button>
        <button type="button">Dynamic</button>
      </div>
      <DesignColorField
        ariaLabel="Slide background color"
        label="Current fill"
        value={getBackgroundColor(background)}
        onChange={(color) => {
          onUpdatePageBackground?.({ type: 'color', color });
        }}
      />
      <DesignSelectField
        ariaLabel="Slide fill type"
        defaultValue="color"
        label="Fill type"
        options={slideFillTypeOptions}
      />
    </>
  );
}
