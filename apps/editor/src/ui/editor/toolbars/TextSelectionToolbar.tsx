import { useState } from 'react';
import type { AlignMode, ElementStylePatch } from '../../../domain/commands/elements/basicCommands';
import type { TextElement } from '../../../domain/documents/model';
import { colorInputValue } from '../panels/design-controls/colorInputValue';

interface TextSelectionToolbarProps {
  disabled?: boolean;
  canTranslateSelection?: boolean;
  element: TextElement;
  onAlignSelectedElement?: (mode: AlignMode) => void;
  onOpenAnimations?: () => void;
  onOpenFontPanel?: () => void;
  onTranslateSelectedText?: () => void;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdateElementStyles?: (elementIds: string[], patch: ElementStylePatch) => void;
  onApplyFormat?: (elementIds: string[], patch: ElementStylePatch) => void;
  selectedElementIds?: string[];
}

const FONT_SIZE_STEP = 4;
const REGULAR_WEIGHT = 600;
const BOLD_WEIGHT = 800;
const textAlignmentOptions = [
  { align: 'left' as const, icon: 'format_align_left', label: 'Align text left' },
  { align: 'center' as const, icon: 'format_align_center', label: 'Align text center' },
  { align: 'right' as const, icon: 'format_align_right', label: 'Align text right' },
];
const positioningOptions = [
  { icon: 'align_horizontal_left', label: 'Center left', mode: 'page-left-center' as const },
  { icon: 'align_horizontal_center', label: 'Center', mode: 'page-center' as const },
  { icon: 'align_horizontal_right', label: 'Center right', mode: 'page-right-center' as const },
  { icon: 'align_vertical_top', label: 'Center top', mode: 'page-top-center' as const },
  { icon: 'align_vertical_bottom', label: 'Center bottom', mode: 'page-bottom-center' as const },
];

const formatPaintStyleKeys = [
  'align',
  'fill',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'stroke',
  'strokeWidth',
] as const satisfies readonly (keyof ElementStylePatch)[];

function getFormatPaintPatch(element: TextElement): ElementStylePatch {
  return Object.fromEntries(formatPaintStyleKeys.map((key) => [key, element[key]]));
}

function normalizeHyperlink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function TextSelectionToolbar({
  disabled = false,
  canTranslateSelection = false,
  element,
  onAlignSelectedElement,
  onOpenAnimations,
  onOpenFontPanel,
  onTranslateSelectedText,
  onUpdateElementStyle,
  onUpdateElementStyles,
  onApplyFormat,
  selectedElementIds = [element.id],
}: TextSelectionToolbarProps) {
  const [showAlignmentMenu, setShowAlignmentMenu] = useState(false);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<ElementStylePatch>();
  const [linkDraft, setLinkDraft] = useState({
    elementId: element.id,
    value: element.hyperlink ?? '',
  });
  const linkValue =
    linkDraft.elementId === element.id ? linkDraft.value : (element.hyperlink ?? '');

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
          value={colorInputValue(element.fill)}
          onChange={(event) => {
            updateStyle({ fill: event.target.value });
          }}
        />
      </label>

      <button
        aria-label={copiedFormat ? 'Paste format' : 'Copy format'}
        className={copiedFormat ? 'text-toolbar-button text-toolbar-button-active' : 'text-toolbar-button'}
        disabled={disabled || element.locked}
        title={copiedFormat ? 'Paste format' : 'Copy format'}
        type="button"
        onClick={() => {
          if (disabled || element.locked) return;
          if (!copiedFormat) {
            setCopiedFormat(getFormatPaintPatch(element));
            return;
          }
          if (onApplyFormat) {
            onApplyFormat(selectedElementIds, copiedFormat);
            setCopiedFormat(undefined);
            return;
          } else if (selectedElementIds.length > 1 && onUpdateElementStyles) {
            onUpdateElementStyles(selectedElementIds, copiedFormat);
            setCopiedFormat(undefined);
            return;
          }
          updateStyle(copiedFormat);
          setCopiedFormat(undefined);
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          format_paint
        </span>
      </button>

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

      <div className="text-toolbar-alignment">
        <button
          aria-expanded={showAlignmentMenu}
          aria-haspopup="menu"
          aria-label="Text alignment menu"
          className={
            showAlignmentMenu || element.align !== 'left'
              ? 'text-toolbar-button text-toolbar-button-active'
              : 'text-toolbar-button'
          }
          disabled={disabled || element.locked}
          title="Align text"
          type="button"
          onClick={() => {
            if (disabled || element.locked) return;
            setShowAlignmentMenu((current) => !current);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {element.align === 'center'
              ? 'format_align_center'
              : element.align === 'right'
                ? 'format_align_right'
                : 'format_align_left'}
          </span>
          <span
            className="material-symbols-outlined text-toolbar-alignment-caret"
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
        {showAlignmentMenu ? (
          <div className="text-toolbar-alignment-menu" role="menu" aria-label="Text alignment">
            {textAlignmentOptions.map((option) => (
              <button
                key={option.align}
                aria-label={option.label}
                aria-pressed={element.align === option.align}
                className="text-toolbar-alignment-option"
                disabled={disabled || element.locked}
                title={option.label}
                type="button"
                onClick={() => {
                  updateStyle({ align: option.align });
                  setShowAlignmentMenu(false);
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {option.icon}
                </span>
                <span>{option.label}</span>
              </button>
            ))}
            {onAlignSelectedElement ? (
              <>
                <div className="text-toolbar-alignment-divider" role="separator" />
                {positioningOptions.map((option) => (
                  <button
                    key={option.mode}
                    aria-label={option.label}
                    className="text-toolbar-alignment-option"
                    disabled={disabled || element.locked}
                    title={option.label}
                    type="button"
                    onClick={() => {
                      onAlignSelectedElement(option.mode);
                      setShowAlignmentMenu(false);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {option.icon}
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </>
            ) : null}
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
