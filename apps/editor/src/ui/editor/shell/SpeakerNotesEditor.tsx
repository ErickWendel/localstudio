import { useCallback, useMemo, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { Page } from '../../../domain/documents/model';

const notesWidthStorageKey = 'localstudio.editorSpeakerNotesWidth';
const notesHeightStorageKey = 'localstudio.editorSpeakerNotesHeight';
const notesDefaultWidthPx = 360;
const notesDefaultHeightPx = 760;
const notesMinWidthPx = 280;
const notesMaxWidthPx = 720;
const notesMinHeightPx = 260;
const notesMaxHeightPx = 900;
const notesResizeStepPx = 32;

function clampNotesWidth(width: number) {
  const viewportMaxWidth =
    typeof window === 'undefined' ? notesMaxWidthPx : Math.max(notesMinWidthPx, window.innerWidth - 40);
  const maxWidth = Math.min(notesMaxWidthPx, viewportMaxWidth);
  return Math.round(Math.min(maxWidth, Math.max(notesMinWidthPx, width)));
}

function getInitialNotesWidth() {
  if (typeof window === 'undefined') return notesDefaultWidthPx;
  const storedValue = window.localStorage.getItem(notesWidthStorageKey);
  if (storedValue === null) return notesDefaultWidthPx;
  const storedWidth = Number(storedValue);
  if (!Number.isFinite(storedWidth)) return notesDefaultWidthPx;
  return clampNotesWidth(storedWidth);
}

function clampNotesHeight(height: number) {
  const viewportMaxHeight =
    typeof window === 'undefined' ? notesMaxHeightPx : Math.max(notesMinHeightPx, window.innerHeight - 88);
  const maxHeight = Math.min(notesMaxHeightPx, viewportMaxHeight);
  return Math.round(Math.min(maxHeight, Math.max(notesMinHeightPx, height)));
}

function getInitialNotesHeight() {
  if (typeof window === 'undefined') return notesDefaultHeightPx;
  const storedValue = window.localStorage.getItem(notesHeightStorageKey);
  if (storedValue === null) return clampNotesHeight(notesDefaultHeightPx);
  const storedHeight = Number(storedValue);
  if (!Number.isFinite(storedHeight)) return clampNotesHeight(notesDefaultHeightPx);
  return clampNotesHeight(storedHeight);
}

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
  const [notesWidth, setNotesWidth] = useState(getInitialNotesWidth);
  const [notesHeight, setNotesHeight] = useState(getInitialNotesHeight);
  const notesEditorStyle = useMemo(
    () =>
      ({
        '--speaker-notes-height': `${notesHeight}px`,
        '--speaker-notes-width': `${notesWidth}px`,
      }) as CSSProperties,
    [notesHeight, notesWidth],
  );

  const updateNotesWidth = useCallback((nextWidth: number | ((currentWidth: number) => number)) => {
    setNotesWidth((currentWidth) => {
      const rawWidth = typeof nextWidth === 'function' ? nextWidth(currentWidth) : nextWidth;
      const clampedWidth = clampNotesWidth(rawWidth);
      window.localStorage.setItem(notesWidthStorageKey, String(clampedWidth));
      return clampedWidth;
    });
  }, []);

  const updateNotesHeight = useCallback((nextHeight: number | ((currentHeight: number) => number)) => {
    setNotesHeight((currentHeight) => {
      const rawHeight = typeof nextHeight === 'function' ? nextHeight(currentHeight) : nextHeight;
      const clampedHeight = clampNotesHeight(rawHeight);
      window.localStorage.setItem(notesHeightStorageKey, String(clampedHeight));
      return clampedHeight;
    });
  }, []);

  const startNotesWidthResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = notesWidth;

    function handlePointerMove(pointerEvent: PointerEvent) {
      updateNotesWidth(startWidth + pointerEvent.clientX - startX);
    }

    function stopResize() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }, [notesWidth, updateNotesWidth]);

  const startNotesHeightResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startY = event.clientY;
    const startHeight = notesHeight;

    function handlePointerMove(pointerEvent: PointerEvent) {
      updateNotesHeight(startHeight + startY - pointerEvent.clientY);
    }

    function stopResize() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }, [notesHeight, updateNotesHeight]);

  const resizeNotesWidthWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'ArrowLeft') {
      updateNotesWidth((currentWidth) => currentWidth - notesResizeStepPx);
      return;
    }
    if (event.key === 'ArrowRight') {
      updateNotesWidth((currentWidth) => currentWidth + notesResizeStepPx);
      return;
    }
    updateNotesWidth(event.key === 'Home' ? notesMinWidthPx : notesMaxWidthPx);
  }, [updateNotesWidth]);

  const resizeNotesHeightWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'ArrowUp') {
      updateNotesHeight((currentHeight) => currentHeight + notesResizeStepPx);
      return;
    }
    if (event.key === 'ArrowDown') {
      updateNotesHeight((currentHeight) => currentHeight - notesResizeStepPx);
      return;
    }
    updateNotesHeight(event.key === 'Home' ? notesMinHeightPx : notesMaxHeightPx);
  }, [updateNotesHeight]);

  return (
    <section className="speaker-notes-editor" aria-label="Speaker notes editor" style={notesEditorStyle}>
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
          <div
            className="speaker-notes-width-resizer"
            role="separator"
            aria-label="Resize speaker notes width"
            aria-orientation="vertical"
            aria-valuemin={notesMinWidthPx}
            aria-valuemax={notesMaxWidthPx}
            aria-valuenow={notesWidth}
            tabIndex={0}
            onKeyDown={resizeNotesWidthWithKeyboard}
            onPointerDown={startNotesWidthResize}
          >
            <span aria-hidden="true" />
          </div>
          <div
            className="speaker-notes-height-resizer"
            role="separator"
            aria-label="Resize speaker notes height"
            aria-orientation="horizontal"
            aria-valuemin={notesMinHeightPx}
            aria-valuemax={notesMaxHeightPx}
            aria-valuenow={notesHeight}
            tabIndex={0}
            onKeyDown={resizeNotesHeightWithKeyboard}
            onPointerDown={startNotesHeightResize}
          >
            <span aria-hidden="true" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
