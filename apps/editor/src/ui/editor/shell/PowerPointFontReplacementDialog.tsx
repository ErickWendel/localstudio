import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FontCatalogItem } from '../../../services/contracts/interfaces';
import type { MissingPowerPointFont } from '../state/useEditorViewModel';

interface PowerPointFontReplacementDialogProps {
  downloadableFonts: FontCatalogItem[];
  missingFonts: MissingPowerPointFont[];
  onClose: () => void;
  onReplaceFont: (missingFamily: string, replacementFamily: string) => Promise<void>;
}

function filterFonts(fonts: FontCatalogItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return fonts.slice(0, 8);
  return fonts
    .filter(
      (font) =>
        font.family.toLowerCase().includes(normalizedQuery) ||
        font.aliases?.some((alias) => alias.toLowerCase().includes(normalizedQuery)),
    )
    .slice(0, 8);
}

export function PowerPointFontReplacementDialog({
  downloadableFonts,
  missingFonts,
  onClose,
  onReplaceFont,
}: PowerPointFontReplacementDialogProps) {
  const [activeFamily, setActiveFamily] = useState(missingFonts[0]?.family ?? '');
  const [query, setQuery] = useState('');
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | undefined>();
  const [replacing, setReplacing] = useState(false);
  const filteredFonts = useMemo(() => filterFonts(downloadableFonts, query), [downloadableFonts, query]);
  const selectedReplacementCount = Object.values(replacements).filter(Boolean).length;

  async function replaceSelectedFonts() {
    const entries = Object.entries(replacements).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    );
    if (entries.length === 0) return;
    setReplacing(true);
    setStatus('Replacing fonts...');
    try {
      for (const [missingFamily, replacementFamily] of entries) {
        await onReplaceFont(missingFamily, replacementFamily);
      }
      setStatus('Fonts replaced.');
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Font replacement failed.');
    } finally {
      setReplacing(false);
    }
  }

  return (
    <div className="pptx-font-dialog-backdrop">
      <section
        className="pptx-font-replacement-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Replace PowerPoint fonts"
      >
        <div className="pptx-font-replacement-header">
          <div>
            <h2>Choose which fonts to replace.</h2>
            <p>Replacing a font affects the entire presentation, including imported layouts.</p>
          </div>
          <button
            className="pptx-font-dialog-close"
            type="button"
            aria-label="Close font replacement"
            disabled={replacing}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="pptx-font-replacement-table" role="table" aria-label="Missing PowerPoint fonts">
          <div className="pptx-font-replacement-row pptx-font-replacement-row-heading" role="row">
            <span role="columnheader">Font</span>
            <span role="columnheader">Replace With</span>
          </div>
          {missingFonts.map((font) => (
            <button
              className={
                activeFamily === font.family
                  ? 'pptx-font-replacement-row pptx-font-replacement-row-active'
                  : 'pptx-font-replacement-row'
              }
              key={font.family}
              role="row"
              type="button"
              onClick={() => setActiveFamily(font.family)}
            >
              <span role="cell" className="ew-ellipsis">
                {font.family}
              </span>
              <span role="cell" className="ew-ellipsis">
                {replacements[font.family] || "(Don't Replace)"}
              </span>
            </button>
          ))}
        </div>

        <div className="pptx-font-search-panel">
          <label className="layer-search pptx-font-search-box ew-surface ew-compact-row">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search Google Fonts for replacement"
              placeholder={`Search Google Fonts for ${activeFamily}`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="pptx-font-search-results" aria-label="Google Fonts replacement results">
            {filteredFonts.map((font) => (
              <button
                className="pptx-font-search-result"
                disabled={replacing || !activeFamily}
                key={font.family}
                type="button"
                onClick={() => {
                  setReplacements((current) => ({ ...current, [activeFamily]: font.family }));
                }}
              >
                <span className="ew-ellipsis">{font.family}</span>
                {font.aliases?.length ? <small>Also matches {font.aliases.join(', ')}</small> : null}
              </button>
            ))}
          </div>
        </div>

        {status ? (
          <div className="pptx-font-replacement-status" role="status">
            {status}
          </div>
        ) : null}

        <div className="pptx-font-dialog-actions">
          <button
            className="compact-action compact-action-secondary"
            type="button"
            disabled={replacing}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="export-button font-orbitron"
            type="button"
            disabled={replacing || selectedReplacementCount === 0}
            onClick={() => {
              void replaceSelectedFonts();
            }}
          >
            Replace Fonts
          </button>
        </div>
      </section>
    </div>
  );
}
