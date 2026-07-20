import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TranscriptSegment } from '../../domain/documents/model';

interface PresenterTranscriptWindowProps {
  sessionId: string;
}

interface PresenterTranscriptStateMessage {
  segments: TranscriptSegment[];
  sessionId: string;
  source: 'localstudio-presenter-transcript';
  status: string;
  type: 'state';
}

interface PresenterTranscriptReadyMessage {
  sessionId: string;
  source: 'localstudio-presenter-transcript-window';
  type: 'ready';
}

function getTranscriptChannelName(sessionId: string) {
  return `localstudio-presenter-transcript-${sessionId}`;
}

function isTranscriptStateMessage(value: unknown): value is PresenterTranscriptStateMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === 'localstudio-presenter-transcript' &&
    record.type === 'state' &&
    typeof record.sessionId === 'string' &&
    Array.isArray(record.segments)
  );
}

function getTeleprompterText(segment: TranscriptSegment) {
  if (segment.pageIndex === undefined) return segment.text;
  return segment.text.replace(new RegExp(`^\\[Slide ${segment.pageIndex + 1}\\]\\s*`, 'i'), '');
}

const teleprompterDefaultFontSizePx = 72;
const teleprompterFontStepPx = 8;
const teleprompterMinFontSizePx = 40;
const teleprompterMaxFontSizePx = 128;

export function PresenterTranscriptWindow({ sessionId }: PresenterTranscriptWindowProps) {
  const transcriptEndRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(teleprompterDefaultFontSizePx);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [status, setStatus] = useState('Waiting for recording');

  useEffect(() => {
    const channel = new BroadcastChannel(getTranscriptChannelName(sessionId));
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isTranscriptStateMessage(event.data)) return;
      if (event.data.sessionId !== sessionId) return;
      setSegments(event.data.segments);
      setStatus(event.data.status);
    };
    const readyMessage: PresenterTranscriptReadyMessage = {
      sessionId,
      source: 'localstudio-presenter-transcript-window',
      type: 'ready',
    };
    channel.postMessage(readyMessage);
    return () => {
      channel.close();
    };
  }, [sessionId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end' });
  }, [segments]);

  const decreaseFontSize = () => {
    setFontSize((current) => Math.max(teleprompterMinFontSizePx, current - teleprompterFontStepPx));
  };
  const increaseFontSize = () => {
    setFontSize((current) => Math.min(teleprompterMaxFontSizePx, current + teleprompterFontStepPx));
  };

  return (
    <main
      className="presenter-transcript-window"
      aria-label="Live transcription"
      style={{ '--presenter-transcript-font-size': `${fontSize}px` } as CSSProperties}
    >
      <div className="presenter-transcript-zoom" aria-label="Teleprompter zoom controls">
        <button type="button" aria-label="Decrease text size" onClick={decreaseFontSize}>
          -
        </button>
        <span aria-label="Transcript text size">{fontSize}px</span>
        <button type="button" aria-label="Increase text size" onClick={increaseFontSize}>
          +
        </button>
      </div>
      <section
        className="presenter-transcript-current"
        aria-label={`Transcription status ${status}`}
        aria-live="polite"
      >
        {segments.length > 0 ? (
          segments.map((segment) => (
            <article className="presenter-transcript-segment" key={segment.id}>
              {segment.pageIndex !== undefined ? (
                <span className="presenter-transcript-slide-marker">
                  Slide {segment.pageIndex + 1}
                </span>
              ) : null}
              <p>{getTeleprompterText(segment)}</p>
            </article>
          ))
        ) : (
          <p>Start recording in presenter mode.</p>
        )}
        <span ref={transcriptEndRef} aria-hidden="true" />
      </section>
    </main>
  );
}
