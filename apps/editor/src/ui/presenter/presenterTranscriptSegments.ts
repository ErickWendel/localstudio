import type { TranscriptSegment } from '../../domain/documents/model';

export interface PresenterTranscriptSlideMarker {
  id: string;
  pageId?: string;
  pageIndex?: number;
  pageName?: string;
  startMs: number;
  textOffset: number;
}

interface PresenterTranscriptBuildOptions {
  currentTimeMs: number;
  final: boolean;
  transcriptText: string;
}

function getSlideLabel(marker: PresenterTranscriptSlideMarker) {
  if (typeof marker.pageIndex === 'number') return `[Slide ${marker.pageIndex + 1}]`;
  return '[Slide]';
}

function normalizeTranscriptText(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

export function buildPresenterTranscriptSegments(
  markers: PresenterTranscriptSlideMarker[],
  options: PresenterTranscriptBuildOptions,
): TranscriptSegment[] {
  const transcriptText = options.transcriptText;
  return markers.map((marker, index) => {
    const nextMarker = markers[index + 1];
    const startOffset = Math.min(marker.textOffset, transcriptText.length);
    const endOffset = Math.min(nextMarker?.textOffset ?? transcriptText.length, transcriptText.length);
    const spokenText = normalizeTranscriptText(transcriptText.slice(startOffset, endOffset));
    const slideLabel = getSlideLabel(marker);
    return {
      id: marker.id,
      text: spokenText ? `${slideLabel} ${spokenText}` : slideLabel,
      startMs: marker.startMs,
      endMs: nextMarker?.startMs ?? options.currentTimeMs,
      ...(marker.pageId ? { pageId: marker.pageId } : {}),
      ...(typeof marker.pageIndex === 'number' ? { pageIndex: marker.pageIndex } : {}),
      ...(marker.pageName ? { pageName: marker.pageName } : {}),
      final: options.final || Boolean(nextMarker),
    };
  });
}
