import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Download,
  Search,
} from 'lucide-react';
import type { FormEvent, RefObject } from 'react';
import type { ElementStylePatch } from '../../../../domain/commands/elements/basicCommands';
import type { TextElement } from '../../../../domain/documents/model';
import type { FontCatalogItem } from '../../../../services/contracts/interfaces';
import { textStyleOptions } from '../../text/textStyleOptions';

export interface TextStyleControls {
  downloadingFontFamily?: string | undefined;
  filteredDownloadableFonts: FontCatalogItem[];
  fontDownloadOpen: boolean;
  fontDownloadStatus?: string | undefined;
  fontFamilyOptions: string[];
  localFontFamilyOptions: string[];
  fontSearchInput: string;
  fontSearchQuery: string;
  fontSelectRef: RefObject<HTMLButtonElement | null>;
  hasFontDownload: boolean;
  onApplyFontFamily: (family: string) => Promise<void>;
  onDownloadFontFamily: (family: string) => Promise<void>;
  onFontSearchInputChange: (value: string) => void;
  onFontSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleFontDownload: () => void;
}

const regularTextWeight = 400;
const boldTextWeight = 800;

function fontMatchesQuery(fontFamily: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return !normalizedQuery || fontFamily.toLowerCase().includes(normalizedQuery);
}

export function TextStyleInspector({
  downloadingFontFamily,
  element,
  filteredDownloadableFonts,
  fontDownloadOpen,
  fontDownloadStatus,
  fontFamilyOptions,
  localFontFamilyOptions,
  fontSearchInput,
  fontSearchQuery,
  fontSelectRef,
  hasFontDownload,
  onApplyFontFamily,
  onDownloadFontFamily,
  onFontSearchInputChange,
  onFontSearchSubmit,
  onToggleFontDownload,
  onUpdateStyle,
}: TextStyleControls & {
  element: TextElement;
  onUpdateStyle: (patch: ElementStylePatch) => void;
}) {
  const selectedTextIsBold = element.fontWeight >= boldTextWeight;
  const fontQuery = fontSearchQuery.trim();
  const matchingProjectFonts = fontFamilyOptions.filter((fontFamily) => fontMatchesQuery(fontFamily, fontQuery));
  const matchingLocalFonts = localFontFamilyOptions.filter((fontFamily) => fontMatchesQuery(fontFamily, fontQuery));

  return (
    <section className="movie-panel-section" aria-label="Selected text controls">
      <h3>Typography</h3>
      <div className="text-inspector-stack">
        <div className="font-control-row">
          <div className="text-inspector-field ew-field-scope ew-grid-compact text-inspector-field-full">
            <span className="text-inspector-label ew-strong-label">Font</span>
            <button
              aria-label="Selected text font"
              aria-expanded={fontDownloadOpen}
              className="font-picker-trigger"
              ref={fontSelectRef}
              style={{ fontFamily: element.fontFamily }}
              type="button"
              onClick={onToggleFontDownload}
            >
              <span className="ew-ellipsis">{element.fontFamily}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        {fontDownloadOpen ? (
          <div className="font-download-panel">
            <form className="font-download-search" onSubmit={onFontSearchSubmit}>
              <label className="layer-search font-download-search-box ew-surface ew-compact-row">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search downloadable fonts"
                  placeholder="Search project, local, or Google fonts"
                  type="search"
                  value={fontSearchInput}
                  onChange={(event) => {
                    onFontSearchInputChange(event.target.value);
                  }}
                />
              </label>
            </form>
            <div className="font-download-results" aria-label="Downloadable font results">
              {matchingProjectFonts.length > 0 ? (
                <section className="font-result-group" aria-label="Project font results">
                  <h4>Project fonts</h4>
                  {matchingProjectFonts.map((fontFamily) => (
                    <button
                      aria-label={`Apply ${fontFamily}`}
                      className="font-download-result font-preview-result"
                      key={fontFamily}
                      type="button"
                      onClick={() => {
                        void onApplyFontFamily(fontFamily);
                      }}
                    >
                      <span className="ew-ellipsis" style={{ fontFamily }}>
                        {fontFamily}
                      </span>
                      {element.fontFamily === fontFamily ? (
                        <span className="material-symbols-outlined font-result-check" aria-hidden="true">
                          check
                        </span>
                      ) : null}
                    </button>
                  ))}
                </section>
              ) : null}
              {matchingLocalFonts.length > 0 ? (
                <section className="font-result-group" aria-label="Local font folder results">
                  <h4>Local font folder</h4>
                  {matchingLocalFonts.map((fontFamily) => (
                    <button
                      aria-label={`Add ${fontFamily} from local fonts`}
                      className="font-download-result font-preview-result"
                      disabled={downloadingFontFamily === fontFamily}
                      key={fontFamily}
                      type="button"
                      onClick={() => {
                        void onApplyFontFamily(fontFamily);
                      }}
                    >
                      <span className="ew-ellipsis" style={{ fontFamily }}>
                        {fontFamily}
                      </span>
                      <Download size={15} />
                    </button>
                  ))}
                </section>
              ) : null}
              {fontSearchQuery ? (
                <section className="font-result-group" aria-label="Google font results">
                  <h4>Google Fonts</h4>
                  {filteredDownloadableFonts.length > 0 ? (
                    filteredDownloadableFonts.map((font) => (
                      <button
                        aria-label={`Download ${font.family}`}
                        className="font-download-result"
                        disabled={!hasFontDownload || downloadingFontFamily === font.family}
                        key={font.family}
                        type="button"
                        onClick={() => {
                          void onDownloadFontFamily(font.family);
                        }}
                      >
                        <span className="ew-ellipsis">{font.family}</span>
                        <Download size={15} />
                      </button>
                    ))
                  ) : (
                    <p className="panel-muted">No Google Fonts match that search.</p>
                  )}
                </section>
              ) : null}
              {matchingProjectFonts.length === 0 &&
              matchingLocalFonts.length === 0 &&
              (!fontSearchQuery || filteredDownloadableFonts.length === 0) ? (
                <p className="panel-muted">No fonts match that search.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {fontDownloadStatus ? (
          <div className="panel-muted" role="status">
            {fontDownloadStatus}
          </div>
        ) : null}
        <div className="text-inspector-pair">
          <label className="text-inspector-field ew-field-scope ew-grid-compact">
            <span className="text-inspector-label ew-strong-label">Weight</span>
            <select
              aria-label="Selected text font weight"
              value={element.fontWeight}
              onChange={(event) => {
                onUpdateStyle({ fontWeight: Number(event.target.value) });
              }}
            >
              {textStyleOptions.TEXT_FONT_WEIGHTS.map((fontWeight) => (
                <option key={fontWeight} value={fontWeight}>
                  {fontWeight}
                </option>
              ))}
            </select>
          </label>
          <label className="text-inspector-field ew-field-scope ew-grid-compact">
            <span className="text-inspector-label ew-strong-label">Size</span>
            <input
              aria-label="Selected text font size"
              min="1"
              type="number"
              value={element.fontSize}
              onChange={(event) => {
                onUpdateStyle({ fontSize: Number(event.target.value) });
              }}
            />
          </label>
        </div>
        <div className="text-style-row" aria-label="Text style controls">
          <button
            aria-label="Bold selected text"
            aria-pressed={selectedTextIsBold}
            className={selectedTextIsBold ? 'text-style-toggle active' : 'text-style-toggle'}
            type="button"
            onClick={() => {
              onUpdateStyle({
                fontWeight: selectedTextIsBold ? regularTextWeight : boldTextWeight,
              });
            }}
          >
            <Bold size={16} />
          </button>
          <button className="text-style-toggle" disabled type="button" aria-label="Italic unavailable">
            <span>I</span>
          </button>
          <button className="text-style-toggle" disabled type="button" aria-label="Underline unavailable">
            <span>U</span>
          </button>
          <button
            className="text-style-toggle"
            disabled
            type="button"
            aria-label="Strikethrough unavailable"
          >
            <span>S</span>
          </button>
        </div>
        <label className="text-color-row">
          <span>Text Color</span>
          <input
            aria-label="Selected text color"
            type="color"
            value={element.fill}
            onChange={(event) => {
              onUpdateStyle({ fill: event.target.value });
            }}
          />
        </label>
        <div className="text-align-grid" aria-label="Selected text alignment">
          {([
            { align: 'left' as const, icon: AlignLeft, label: 'Align selected text left' },
            { align: 'center' as const, icon: AlignCenter, label: 'Align selected text center' },
            { align: 'right' as const, icon: AlignRight, label: 'Align selected text right' },
          ]).map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-label={item.label}
                aria-pressed={element.align === item.align}
                className={element.align === item.align ? 'text-align-button active' : 'text-align-button'}
                key={item.align}
                type="button"
                onClick={() => {
                  onUpdateStyle({ align: item.align });
                }}
              >
                <Icon size={18} />
              </button>
            );
          })}
          {([
            { align: 'top' as const, icon: 'vertical_align_top', label: 'Align selected text top' },
            {
              align: 'middle' as const,
              icon: 'vertical_align_center',
              label: 'Align selected text middle',
            },
            {
              align: 'bottom' as const,
              icon: 'vertical_align_bottom',
              label: 'Align selected text bottom',
            },
          ]).map((item) => (
            <button
              aria-label={item.label}
              aria-pressed={(element.verticalAlign ?? 'top') === item.align}
              className={
                (element.verticalAlign ?? 'top') === item.align
                  ? 'text-align-button active'
                  : 'text-align-button'
              }
              key={item.align}
              type="button"
              onClick={() => {
                onUpdateStyle({ verticalAlign: item.align });
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
