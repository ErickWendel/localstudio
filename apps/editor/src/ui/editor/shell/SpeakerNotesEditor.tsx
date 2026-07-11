import type { Page } from '../../../domain/documents/model';

interface SpeakerNotesEditorProps {
  page: Page;
  pageIndex: number;
  open: boolean;
  onClose: () => void;
  onUpdateNotes: (pageId: string, notes: string) => void;
}

export function SpeakerNotesEditor({
  page,
  pageIndex,
  open,
  onClose,
  onUpdateNotes,
}: SpeakerNotesEditorProps) {
  return (
    <section className="speaker-notes-editor" aria-label="Speaker notes editor">
      {open ? (
        <div className="speaker-notes-card">
          <header className="speaker-notes-header">
            <h2>
              Page {pageIndex + 1} - {page.name}
            </h2>
            <div className="speaker-notes-actions ew-compact-row">
              <button type="button" aria-label="Change notes text size">
                aA
              </button>
              <button type="button" aria-label="Close notes panel" onClick={onClose}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
          </header>
          <textarea
            id="speaker-notes-textarea"
            aria-label="Speaker notes"
            maxLength={5000}
            placeholder="Add notes to your design"
            value={page.speakerNotes ?? ''}
            onChange={(event) => onUpdateNotes(page.id, event.target.value)}
          />
          <span className="speaker-notes-count">{page.speakerNotes?.length ?? 0}/5000</span>
        </div>
      ) : null}
    </section>
  );
}
