import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Plus,
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
  fontSearchInput: string;
  fontSearchQuery: string;
  fontSelectRef: RefObject<HTMLSelectElement | null>;
  hasFontDownload: boolean;
  onDownloadFontFamily: (family: string) => Promise<void>;
  onFontSearchInputChange: (value: string) => void;
  onFontSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleFontDownload: () => void;
}

const regularTextWeight = 400;
const boldTextWeight = 800;

export function TextStyleInspector({
  downloadingFontFamily,
  element,
  filteredDownloadableFonts,
  fontDownloadOpen,
  fontDownloadStatus,
  fontFamilyOptions,
  fontSearchInput,
  fontSearchQuery,
  fontSelectRef,
  hasFontDownload,
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

  return (
    <section className="movie-panel-section" aria-label="Selected text controls">
      <h3>Typography</h3>
      <div className="text-inspector-stack">
        <div className="font-control-row">
          <label className="text-inspector-field ew-field-scope ew-grid-compact text-inspector-field-full">
            <span className="text-inspector-label ew-strong-label">Font</span>
            <select
              aria-label="Selected text font"
              ref={fontSelectRef}
              value={element.fontFamily}
              onChange={(event) => {
                onUpdateStyle({ fontFamily: event.target.value });
              }}
            >
              {fontFamilyOptions.map((fontFamily) => (
                <option key={fontFamily} value={fontFamily}>
                  {fontFamily}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-expanded={fontDownloadOpen}
            aria-label="Download additional font"
            className="font-add-button"
            title="Download additional font"
            type="button"
            onClick={onToggleFontDownload}
          >
            <Plus size={16} />
          </button>
        </div>
        {fontDownloadOpen ? (
          <div className="font-download-panel">
            <form className="font-download-search" onSubmit={onFontSearchSubmit}>
              <label className="layer-search font-download-search-box ew-surface ew-compact-row">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search downloadable fonts"
                  placeholder="Search Google Fonts"
                  type="search"
                  value={fontSearchInput}
                  onChange={(event) => {
                    onFontSearchInputChange(event.target.value);
                  }}
                />
              </label>
              <button className="font-search-submit" type="submit" aria-label="Search fonts">
                <Search size={16} />
              </button>
            </form>
            {fontSearchQuery ? (
              <div className="font-download-results" aria-label="Downloadable font results">
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
              </div>
            ) : null}
            {fontDownloadStatus ? (
              <div className="panel-muted" role="status">
                {fontDownloadStatus}
              </div>
            ) : null}
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
        </div>
      </div>
    </section>
  );
}
