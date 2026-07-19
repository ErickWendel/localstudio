import { useEffect, useState } from 'react';
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

function formatTimestamp(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function PresenterTranscriptWindow({ sessionId }: PresenterTranscriptWindowProps) {
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
    return () => {
      channel.close();
    };
  }, [sessionId]);

  const latestSegment = segments.at(-1);

  return (
    <main className="presenter-transcript-window" aria-label="Live transcription">
      <header>
        <span>Live transcription</span>
        <strong>{status}</strong>
      </header>
      <section className="presenter-transcript-current" aria-live="polite">
        {latestSegment?.text ?? 'Start recording in presenter mode.'}
      </section>
      <ol className="presenter-transcript-list">
        {segments.map((segment) => (
          <li key={segment.id}>
            <time>{formatTimestamp(segment.startMs)}</time>
            <span>{segment.text}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
