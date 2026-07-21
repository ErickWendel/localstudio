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
        recordingId: recording.id,
        segment,
        text: segment.text.trim(),
      })),
  );
}

function createPrompt(question: string, citations: TranscriptAnswerCitation[]) {
  const context = citations
    .map(
      (citation, index) =>
        `[${index + 1}] ${Math.round(citation.startMs / 1000)}s-${Math.round(
          citation.endMs / 1000,
        )}s: ${citation.text}`,
    )
    .join('\n');
  return [
    {
      role: 'system',
      content:
        'Answer only from the transcript context. If the answer is not in the transcript, say you cannot find it in the transcript. Keep the answer concise and mention the cited timestamps.',
    },
    {
      role: 'user',
      content: `Transcript context:\n${context}\n\nQuestion: ${question}`,
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

  async answer(question: string, recordings: TranscriptRecording[]): Promise<TranscriptAnswer> {
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
      createPrompt(trimmedQuestion, citations),
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
