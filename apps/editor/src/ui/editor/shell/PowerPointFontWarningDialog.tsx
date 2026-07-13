import { AlertTriangle, X } from 'lucide-react';
import type { MissingPowerPointFont } from '../state/useEditorViewModel';

interface PowerPointFontWarningDialogProps {
  missingFonts: MissingPowerPointFont[];
  onDismiss: () => void;
  onReplaceFonts: () => void;
}

export function PowerPointFontWarningDialog({
  missingFonts,
  onDismiss,
  onReplaceFonts,
}: PowerPointFontWarningDialogProps) {
  return (
    <div className="pptx-font-dialog-backdrop">
      <section
        className="pptx-font-warning-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="PowerPoint font warnings"
      >
        <button
          className="pptx-font-dialog-close"
          type="button"
          aria-label="Dismiss PowerPoint font warnings"
          onClick={onDismiss}
        >
          <X size={16} />
        </button>
        <div className="pptx-font-warning-heading">
          <h2>This PowerPoint presentation may look different.</h2>
          <p>Here is what changed when you opened it in LocalStudio.</p>
        </div>
        <div className="pptx-font-warning-list">
          {missingFonts.map((font) => (
            <div className="pptx-font-warning-row" key={font.family}>
              <AlertTriangle size={16} aria-hidden="true" />
              <p>
                The font <strong>{font.family}</strong> is missing. Your text might look
                different.
              </p>
            </div>
          ))}
        </div>
        <p className="pptx-font-warning-note">
          If you install the missing font on your system, LocalStudio will use it automatically
          the next time you open this presentation.
        </p>
        <div className="pptx-font-dialog-actions">
          <button className="compact-action compact-action-secondary" type="button" onClick={onDismiss}>
            Keep Defaults
          </button>
          <button className="export-button font-orbitron" type="button" onClick={onReplaceFonts}>
            Replace Fonts
          </button>
        </div>
      </section>
    </div>
  );
}
