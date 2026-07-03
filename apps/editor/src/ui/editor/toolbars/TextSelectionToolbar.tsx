import type { ElementStylePatch } from '../../../domain/commands/elements/basicCommands';
import type { TextElement } from '../../../domain/documents/model';
import { textStyleOptions } from '../text/textStyleOptions';

interface TextSelectionToolbarProps {
  disabled?: boolean;
  canTranslateSelection?: boolean;
  element: TextElement;
  onOpenAnimations?: () => void;
  onTranslateSelectedText?: () => void;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
}

const FONT_SIZE_STEP = 4;
const REGULAR_WEIGHT = 600;
const BOLD_WEIGHT = 800;

export function TextSelectionToolbar({
  disabled = false,
  canTranslateSelection = false,
  element,
  onOpenAnimations,
  onTranslateSelectedText,
  onUpdateElementStyle,
}: TextSelectionToolbarProps) {
  function updateStyle(patch: ElementStylePatch) {
    if (disabled || element.locked) return;
    onUpdateElementStyle?.(element.id, patch);
  }

  const isBold = element.fontWeight >= BOLD_WEIGHT;

  return (
    <div className="text-selection-toolbar" role="toolbar" aria-label="Text editing controls">
      <select
        aria-label="Text font family"
        className="text-toolbar-font"
        disabled={disabled || element.locked}
        value={element.fontFamily}
        onChange={(event) => {
          updateStyle({ fontFamily: event.target.value });
        }}
      >
        {textStyleOptions.TEXT_FONT_FAMILIES.map((fontFamily) => (
          <option key={fontFamily} value={fontFamily}>
            {fontFamily}
          </option>
        ))}
      </select>

      <div className="text-toolbar-size" aria-label="Text size">
        <button
          aria-label="Decrease text size"
          disabled={disabled || element.locked || element.fontSize <= 1}
          type="button"
          onClick={() => {
            updateStyle({ fontSize: Math.max(1, element.fontSize - FONT_SIZE_STEP) });
          }}
        >
          -
        </button>
        <input
          aria-label="Text font size"
          disabled={disabled || element.locked}
          min="1"
          type="number"
          value={element.fontSize}
          onChange={(event) => {
            updateStyle({ fontSize: Number(event.target.value) });
          }}
        />
        <button
          aria-label="Increase text size"
          disabled={disabled || element.locked}
          type="button"
          onClick={() => {
            updateStyle({ fontSize: element.fontSize + FONT_SIZE_STEP });
          }}
        >
          +
        </button>
      </div>

      <label className="text-toolbar-color" title="Text color">
        <span className="material-symbols-outlined" aria-hidden="true">
          format_color_text
        </span>
        <input
          aria-label="Text color"
          disabled={disabled || element.locked}
          type="color"
          value={element.fill}
          onChange={(event) => {
            updateStyle({ fill: event.target.value });
          }}
        />
      </label>

      <button
        aria-pressed={isBold}
        aria-label="Bold text"
        className={
          isBold ? 'text-toolbar-button text-toolbar-button-active' : 'text-toolbar-button'
        }
        disabled={disabled || element.locked}
        type="button"
        onClick={() => {
          updateStyle({ fontWeight: isBold ? REGULAR_WEIGHT : BOLD_WEIGHT });
        }}
      >
        B
      </button>

      <div className="text-toolbar-segment" aria-label="Text alignment">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            aria-label={`Align text ${align}`}
            aria-pressed={element.align === align}
            className={
              element.align === align
                ? 'text-toolbar-button text-toolbar-button-active'
                : 'text-toolbar-button'
            }
            disabled={disabled || element.locked}
            type="button"
            onClick={() => {
              updateStyle({ align });
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {align === 'left'
                ? 'format_align_left'
                : align === 'center'
                  ? 'format_align_center'
                  : 'format_align_right'}
            </span>
          </button>
        ))}
      </div>

      <button
        aria-label="Animate"
        className="text-toolbar-button"
        disabled={disabled}
        title="Animate"
        type="button"
        onClick={onOpenAnimations}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          animation
        </span>
      </button>

      <button
        aria-label="Translate Selected Text"
        className="text-toolbar-button text-toolbar-button-ai"
        disabled={disabled || !canTranslateSelection}
        title="Translate Selected Text"
        type="button"
        onClick={onTranslateSelectedText}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          translate
        </span>
      </button>
    </div>
  );
}
