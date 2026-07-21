import type { TranscriptRecording, TranscriptSegment } from '../../domain/documents/model';
import type {
  TextGenerationInput,
  TextGenerationOptions,
} from '../prompting/webGpuTextGenerationRuntime';
import { TranscriptEmbeddingRuntimeClient } from './transcriptEmbeddingRuntimeClient';
import type { TranscriptEmbeddingPreset } from './transcriptionModelCatalog';
import { transcriptionModelCatalog } from './transcriptionModelCatalog';

export interface TranscriptAnswerCitation {
  endMs: number;
  recordingId: string;
  segmentId: string;
  startMs: number;
  text: string;
}

export interface TranscriptAnswer {
  citations: TranscriptAnswerCitation[];
  text: string;
}

export interface TranscriptQuestionContext {
  currentSlide: {
    id: string;
    index: number;
    name: string;
    speakerNotes?: string;
    text: string[];
    totalSlides: number;
  };
}

interface TranscriptIndexEntry {
  embedding: number[];
  id: string;
  recordingId: string;
  segment: TranscriptSegment;
  text: string;
}

interface TranscriptQuestionAnsweringServiceOptions {
  embeddingClient?: TranscriptEmbeddingRuntimeClient;
  embeddingPreset?: TranscriptEmbeddingPreset;
  textGenerator: {
    generate(prompt: TextGenerationInput, options?: TextGenerationOptions): Promise<string>;
  };
}

function normalizeSegments(recordings: TranscriptRecording[]) {
  return recordings.flatMap((recording) =>
    recording.segments
      .filter((segment) => segment.final && segment.text.trim())
      .map((segment) => ({
        id: `${recording.id}:${segment.id}`,
        recordingName: recording.name,
        recordingId: recording.id,
        segment,
        text: segment.text.trim(),
      })),
  );
}

function formatSegmentTimestamp(milliseconds: number) {
  return `${Math.round(milliseconds / 1000)}s`;
}

function createPrompt(
  question: string,
  transcript: ReturnType<typeof normalizeSegments>,
  citations: TranscriptAnswerCitation[],
  context?: TranscriptQuestionContext,
) {
  const currentSlide = context?.currentSlide;
  const slideContext = currentSlide
    ? [
        `Slide ${currentSlide.index + 1} of ${currentSlide.totalSlides}`,
        `Name: ${currentSlide.name}`,
        `ID: ${currentSlide.id}`,
        `Visible text:\n${currentSlide.text.length > 0 ? currentSlide.text.join('\n') : '(none)'}`,
        `Speaker notes: ${currentSlide.speakerNotes?.trim() || '(none)'}`,
      ].join('\n')
    : 'Current slide information is unavailable.';
  const fullTranscript = transcript
    .map((entry, index) => {
      const pageLabel =
        entry.segment.pageName ??
        (typeof entry.segment.pageIndex === 'number'
          ? `Slide ${entry.segment.pageIndex + 1}`
          : (entry.segment.pageId ?? 'Unassigned slide'));
      return `[${index + 1}] ${entry.recordingName} | ${pageLabel} | ${formatSegmentTimestamp(
        entry.segment.startMs,
      )}-${formatSegmentTimestamp(entry.segment.endMs)}: ${entry.text}`;
    })
    .join('\n');
  const relevantCitations = citations
    .map(
      (citation, index) =>
        `[${index + 1}] ${formatSegmentTimestamp(citation.startMs)}-${formatSegmentTimestamp(
          citation.endMs,
        )}: ${citation.text}`,
    )
    .join('\n');
  return [
    {
      role: 'system',
      content:
        'Answer only from the current slide context and full presentation transcript. If the answer is not available there, say you cannot find it in the presentation. Keep the answer concise and mention timestamps when relevant.',
    },
    {
      role: 'user',
      content: `Current slide context:\n${slideContext}\n\nFull presentation transcript:\n${fullTranscript}\n\nMost relevant timestamp citations:\n${relevantCitations}\n\nQuestion: ${question}`,
    },
  ];
}

export class TranscriptQuestionAnsweringService {
  private readonly embeddingClient: TranscriptEmbeddingRuntimeClient;
  private readonly embeddingPreset: TranscriptEmbeddingPreset;
  private index: TranscriptIndexEntry[] = [];
  private indexedRecordingIds = '';

  constructor(private readonly options: TranscriptQuestionAnsweringServiceOptions) {
    this.embeddingClient = options.embeddingClient ?? new TranscriptEmbeddingRuntimeClient();
    this.embeddingPreset =
      options.embeddingPreset ?? transcriptionModelCatalog.getEmbeddingPreset(undefined);
  }

  async answer(
    question: string,
    recordings: TranscriptRecording[],
    context?: TranscriptQuestionContext,
  ): Promise<TranscriptAnswer> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return { citations: [], text: '' };
    await this.ensureIndex(recordings);
    if (this.index.length === 0) {
      return {
        citations: [],
        text: 'No transcript text is available for this presentation.',
      };
    }

    const matches = await this.embeddingClient.search(
      this.embeddingPreset,
      trimmedQuestion,
      this.index,
      4,
    );
    const citations: TranscriptAnswerCitation[] = matches.map((match) => ({
      endMs: match.segment.endMs,
      recordingId: match.recordingId,
      segmentId: match.segment.id,
      startMs: match.segment.startMs,
      text: match.segment.text,
    }));
    const text = await this.options.textGenerator.generate(
      createPrompt(trimmedQuestion, normalizeSegments(recordings), citations, context),
      {
        do_sample: false,
        max_new_tokens: 220,
        temperature: 0.1,
      },
    );
    return { citations, text: text.trim() };
  }

  private async ensureIndex(recordings: TranscriptRecording[]) {
    const recordingIds = recordings
      .map((recording) => `${recording.id}:${recording.updatedAt}`)
      .sort()
      .join('|');
    if (recordingIds === this.indexedRecordingIds) return;

    const entries = normalizeSegments(recordings);
    const embeddings = await this.embeddingClient.embed(
      this.embeddingPreset,
      entries.map((entry) => entry.text),
    );
    this.index = entries.flatMap((entry, index) => {
      const embedding = embeddings[index];
      return embedding ? [{ ...entry, embedding }] : [];
    });
    this.indexedRecordingIds = recordingIds;
  }
}
