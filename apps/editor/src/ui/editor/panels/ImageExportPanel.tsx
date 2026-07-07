import { useState } from 'react';

export type ImageExportFormat = 'jpeg' | 'png';

export interface ImageExportOptions {
  format: ImageExportFormat;
  includeAnimationFrames: boolean;
  slideRange: 'all' | { from: number; to: number };
}

interface ImageExportPanelProps {
  isExporting?: boolean;
  pageCount: number;
  onClose: () => void;
  onExport: (options: ImageExportOptions) => void;
}

function clampSlideNumber(value: number, pageCount: number) {
  return Math.max(1, Math.min(pageCount, Math.trunc(value) || 1));
}

export function ImageExportPanel({
  isExporting = false,
  pageCount,
  onClose,
  onExport,
}: ImageExportPanelProps) {
  const [slideScope, setSlideScope] = useState<'all' | 'range'>('all');
  const [fromSlide, setFromSlide] = useState(1);
  const [toSlide, setToSlide] = useState(pageCount);
  const [includeAnimationFrames, setIncludeAnimationFrames] = useState(false);
  const [format, setFormat] = useState<ImageExportFormat>('png');
  const rangeDisabled = slideScope === 'all' || isExporting;

  return (
    <aside
      className="settings-panel image-export-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Export images"
    >
      <div className="settings-panel-header ew-split-row-start">
        <div>
          <h2>Export images</h2>
          <p>Download slides as a ZIP archive.</p>
        </div>
        <button
          className="stitch-icon-button"
          type="button"
          aria-label="Close image export"
          disabled={isExporting}
          onClick={onClose}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>
      <form
        className="image-export-form"
        onSubmit={(event) => {
          event.preventDefault();
          const safeFrom = clampSlideNumber(fromSlide, pageCount);
          const safeTo = clampSlideNumber(toSlide, pageCount);
          onExport({
            format,
            includeAnimationFrames,
            slideRange:
              slideScope === 'all'
                ? 'all'
                : { from: Math.min(safeFrom, safeTo), to: Math.max(safeFrom, safeTo) },
          });
        }}
      >
        <fieldset className="image-export-fieldset">
          <legend>Slides</legend>
          <label className="image-export-radio-row">
            <input
              checked={slideScope === 'all'}
              disabled={isExporting}
              name="image-export-slide-scope"
              type="radio"
              value="all"
              onChange={() => setSlideScope('all')}
            />
            All
          </label>
          <label className="image-export-radio-row image-export-range-row">
            <input
              checked={slideScope === 'range'}
              disabled={isExporting}
              name="image-export-slide-scope"
              type="radio"
              value="range"
              onChange={() => setSlideScope('range')}
            />
            <span>From:</span>
            <input
              aria-label="From slide"
              disabled={rangeDisabled}
              min={1}
              max={pageCount}
              type="number"
              value={fromSlide}
              onChange={(event) => setFromSlide(Number(event.target.value))}
            />
            <span>to</span>
            <input
              aria-label="To slide"
              disabled={rangeDisabled}
              min={1}
              max={pageCount}
              type="number"
              value={toSlide}
              onChange={(event) => setToSlide(Number(event.target.value))}
            />
          </label>
        </fieldset>
        <label className="image-export-checkbox-row">
          <input
            checked={includeAnimationFrames}
            disabled={isExporting}
            type="checkbox"
            onChange={(event) => setIncludeAnimationFrames(event.target.checked)}
          />
          Create an image for each animation
        </label>
        <label className="image-export-format-row">
          <span>Format:</span>
          <select
            aria-label="Image format"
            disabled={isExporting}
            value={format}
            onChange={(event) => setFormat(event.target.value as ImageExportFormat)}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG (Higher Quality)</option>
          </select>
        </label>
        <div className="media-integration-actions">
          <button className="export-button font-orbitron" type="submit" disabled={isExporting}>
            {isExporting ? 'Exporting images...' : 'Export images'}
          </button>
          <button
            className="compact-action compact-action-secondary ew-surface ew-surface-hover ew-compact-row"
            type="button"
            disabled={isExporting}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}
