import { useEffect, useMemo, useRef, useState } from 'react';
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

const teleprompterDefaultFontSizePx = 72;
const teleprompterFontStepPx = 8;
const teleprompterMinFontSizePx = 40;
const teleprompterMaxFontSizePx = 128;

export function PresenterTranscriptWindow({ sessionId }: PresenterTranscriptWindowProps) {
  const transcriptTextRef = useRef<HTMLDivElement>(null);
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

  const teleprompterText = useMemo(
    () => segments.map((segment) => segment.text).join(' ').trim(),
    [segments],
  );

  useEffect(() => {
    const element = transcriptTextRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [teleprompterText]);

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
        ref={transcriptTextRef}
        className="presenter-transcript-current"
        aria-label={`Transcription status ${status}`}
        aria-live="polite"
      >
        {teleprompterText || 'Start recording in presenter mode.'}
      </section>
    </main>
  );
}
