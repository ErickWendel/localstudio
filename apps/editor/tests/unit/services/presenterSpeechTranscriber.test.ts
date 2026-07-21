import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresenterSpeechTranscriber } from '../../../src/services/transcription/presenterSpeechTranscriber';

interface FakeSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { transcript?: string } | undefined;
}

interface FakeSpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: FakeSpeechRecognitionResult | undefined;
}

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 0;
  onend: (() => void) | null = null;
  onerror: ((event: { error?: string; message?: string }) => void) | null = null;
  onresult:
    | ((event: { resultIndex: number; results: FakeSpeechRecognitionResultList }) => void)
    | null = null;
  started = false;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.started = true;
  }

  stop() {
    this.started = false;
    this.onend?.();
  }

  abort() {
    this.started = false;
    this.onend?.();
  }

  emitResult(resultIndex: number, results: FakeSpeechRecognitionResult[]) {
    this.onresult?.({ resultIndex, results });
  }
}

function result(transcript: string, isFinal: boolean): FakeSpeechRecognitionResult {
  return { 0: { transcript }, isFinal, length: 1 };
}

describe('PresenterSpeechTranscriber', () => {
  afterEach(() => {
    FakeSpeechRecognition.instances = [];
    vi.restoreAllMocks();
  });

  it('streams interim text and appends finalized speech like the Chrome Web Speech demo', () => {
    const updates: Array<{ final: boolean; text: string }> = [];
    const transcriber = new PresenterSpeechTranscriber({
      onTranscript: (update) => updates.push(update),
      recognitionConstructor: FakeSpeechRecognition,
    });

    transcriber.start('en-US');
    const recognition = FakeSpeechRecognition.instances[0]!;
    recognition.emitResult(0, [result('Hello there', false)]);
    recognition.emitResult(0, [result('Hello there', true)]);
    recognition.emitResult(1, [result('Hello there', true), result('this is live', false)]);

    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe('en-US');
    expect(updates).toEqual([
      { final: false, text: 'Hello there' },
      { final: true, text: 'Hello there' },
      { final: false, text: 'Hello there this is live' },
    ]);
  });

  it('restarts with a new language without clearing the transcript', async () => {
    const updates: string[] = [];
    const transcriber = new PresenterSpeechTranscriber({
      onTranscript: (update) => updates.push(update.text),
      recognitionConstructor: FakeSpeechRecognition,
    });

    transcriber.start('pt-BR');
    FakeSpeechRecognition.instances[0]!.emitResult(0, [result('Ola mundo', true)]);
    await transcriber.setLanguage('en-US');
    FakeSpeechRecognition.instances[1]!.emitResult(0, [result('hello again', true)]);

    expect(FakeSpeechRecognition.instances.map((instance) => instance.lang)).toEqual([
      'pt-BR',
      'en-US',
    ]);
    expect(updates).toEqual(['Ola mundo', 'Ola mundo hello again']);
  });

  it('reports unsupported browsers before recording depends on a model download', () => {
    const transcriber = new PresenterSpeechTranscriber({
      onTranscript: vi.fn(),
    });

    expect(() => transcriber.start('en-US')).toThrow('Web Speech API is not supported');
  });
});
