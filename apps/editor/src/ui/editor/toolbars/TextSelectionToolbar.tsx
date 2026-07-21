import { useState } from 'react';
import type { ElementStylePatch } from '../../../domain/commands/elements/basicCommands';
import type { TextElement } from '../../../domain/documents/model';

interface TextSelectionToolbarProps {
  disabled?: boolean;
  activeTextSelection?: { elementId: string; start: number; end: number } | undefined;
  canTranslateSelection?: boolean;
  element: TextElement;
  onOpenAnimations?: () => void;
  onOpenFontPanel?: () => void;
  onTranslateSelectedText?: () => void;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
}

const FONT_SIZE_STEP = 4;
const REGULAR_WEIGHT = 600;
const BOLD_WEIGHT = 800;
const COLOR_INPUT_FALLBACK = '#000000';

const horizontalAlignments = [
  { align: 'left' as const, icon: 'format_align_left', label: 'Align text left' },
  { align: 'center' as const, icon: 'format_align_center', label: 'Align text center' },
  { align: 'right' as const, icon: 'format_align_right', label: 'Align text right' },
  { align: 'justify' as const, icon: 'format_align_justify', label: 'Align text justify' },
];

const verticalAlignments = [
  { align: 'top' as const, icon: 'vertical_align_top', label: 'Align text top' },
  { align: 'middle' as const, icon: 'vertical_align_center', label: 'Align text middle' },
  { align: 'bottom' as const, icon: 'vertical_align_bottom', label: 'Align text bottom' },
];

function normalizeHyperlink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeColorInputValue(fill: string) {
  return /^#[\da-f]{6}$/i.test(fill) ? fill : COLOR_INPUT_FALLBACK;
}

function getTextColorAtIndex(element: TextElement, index: number) {
  return (
    element.colorRanges?.find((range) => range.start <= index && index < range.end)?.fill ??
    element.fill
  );
}

function getSelectedTextColor(
  element: TextElement,
  selection: TextSelectionToolbarProps['activeTextSelection'],
) {
  if (!selection || selection.elementId !== element.id || selection.start >= selection.end) {
    return element.fill;
  }
  const clampedStart = Math.max(0, Math.min(element.text.length, selection.start));
  const clampedEnd = Math.max(0, Math.min(element.text.length, selection.end));
  if (clampedStart >= clampedEnd) return element.fill;
  const firstColor = getTextColorAtIndex(element, clampedStart);
  const hasMixedColor = Array.from({ length: clampedEnd - clampedStart }).some((_, offset) => {
    return getTextColorAtIndex(element, clampedStart + offset) !== firstColor;
  });
  return hasMixedColor ? element.fill : firstColor;
}

function getCurrentAlignmentIcon(element: TextElement) {
  return (
    horizontalAlignments.find((item) => item.align === element.align)?.icon ??
    'format_align_left'
  );
}

export function TextSelectionToolbar({
  activeTextSelection,
  disabled = false,
  canTranslateSelection = false,
  element,
  onOpenAnimations,
  onOpenFontPanel,
  onTranslateSelectedText,
  onUpdateElementStyle,
}: TextSelectionToolbarProps) {
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [showAlignmentMenu, setShowAlignmentMenu] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ elementId: element.id, value: element.hyperlink ?? '' });
  const linkValue = linkDraft.elementId === element.id ? linkDraft.value : (element.hyperlink ?? '');
  const selectedTextColor = normalizeColorInputValue(getSelectedTextColor(element, activeTextSelection));

  function updateStyle(patch: ElementStylePatch) {
    if (disabled || element.locked) return;
    onUpdateElementStyle?.(element.id, patch);
  }

  const isBold = element.fontWeight >= BOLD_WEIGHT;
  const hasHyperlink = Boolean(element.hyperlink);

  return (
    <div className="text-selection-toolbar" role="toolbar" aria-label="Text editing controls">
      <button
        aria-label="Text font family"
        className="text-toolbar-font"
        disabled={disabled || element.locked}
        title="Open font list"
        type="button"
        onClick={() => {
          if (disabled || element.locked) return;
          onOpenFontPanel?.();
        }}
      >
        {element.fontFamily}
      </button>

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
          value={selectedTextColor}
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

      <div className="text-toolbar-alignment" aria-label="Text alignment">
        <button
          aria-expanded={showAlignmentMenu}
          aria-haspopup="menu"
          aria-label="Text alignment menu"
          className="text-toolbar-button text-toolbar-alignment-trigger"
          disabled={disabled || element.locked}
          title="Text alignment"
          type="button"
          onClick={() => {
            setShowAlignmentMenu((current) => !current);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {getCurrentAlignmentIcon(element)}
          </span>
          <span className="material-symbols-outlined text-toolbar-chevron" aria-hidden="true">
            arrow_drop_down
          </span>
        </button>
        {showAlignmentMenu ? (
          <div className="text-toolbar-alignment-menu" role="menu" aria-label="Text alignment options">
            <div className="text-toolbar-alignment-row">
              {horizontalAlignments.map((item) => (
                <button
                  key={item.align}
                  aria-label={item.label}
                  aria-pressed={item.align !== 'justify' && element.align === item.align}
                  className={
                    element.align === item.align
                      ? 'text-toolbar-button text-toolbar-button-active'
                      : 'text-toolbar-button'
                  }
                  disabled={disabled || element.locked || item.align === 'justify'}
                  type="button"
                  onClick={() => {
                    if (item.align === 'justify') return;
                    updateStyle({ align: item.align });
                    setShowAlignmentMenu(false);
                  }}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {item.icon}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-toolbar-alignment-row">
              {verticalAlignments.map((item) => (
                <button
                  key={item.align}
                  aria-label={item.label}
                  aria-pressed={(element.verticalAlign ?? 'top') === item.align}
                  className={
                    (element.verticalAlign ?? 'top') === item.align
                      ? 'text-toolbar-button text-toolbar-button-active'
                      : 'text-toolbar-button'
                  }
                  disabled={disabled || element.locked}
                  type="button"
                  onClick={() => {
                    updateStyle({ verticalAlign: item.align });
                    setShowAlignmentMenu(false);
                  }}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {item.icon}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <button
        aria-expanded={showLinkEditor}
        aria-label="Edit text hyperlink"
        aria-pressed={hasHyperlink}
        className={
          hasHyperlink ? 'text-toolbar-button text-toolbar-button-active' : 'text-toolbar-button'
        }
        disabled={disabled || element.locked}
        title="Edit text hyperlink"
        type="button"
        onClick={() => {
          setShowLinkEditor((current) => !current);
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          link
        </span>
      </button>

      {showLinkEditor ? (
        <form
          className="text-toolbar-link-editor"
          onSubmit={(event) => {
            event.preventDefault();
            updateStyle({ hyperlink: normalizeHyperlink(linkValue) });
            setShowLinkEditor(false);
          }}
        >
          <input
            aria-label="Text hyperlink URL"
            disabled={disabled || element.locked}
            placeholder="https://example.com"
            type="text"
            value={linkValue}
            onChange={(event) => {
              setLinkDraft({ elementId: element.id, value: event.target.value });
            }}
          />
          <button disabled={disabled || element.locked} type="submit">
            Apply
          </button>
          <button
            disabled={disabled || element.locked || !hasHyperlink}
            type="button"
            onClick={() => {
              setLinkDraft({ elementId: element.id, value: '' });
              updateStyle({ hyperlink: null });
              setShowLinkEditor(false);
            }}
          >
            Clear
          </button>
        </form>
      ) : null}

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
