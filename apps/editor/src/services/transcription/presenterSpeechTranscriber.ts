export interface PresenterSpeechTranscriptUpdate {
  final: boolean;
  text: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike | undefined;
}

interface SpeechRecognitionResultEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error?: string;
  readonly message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface PresenterSpeechTranscriberOptions {
  onError?: ((message: string) => void) | undefined;
  onTranscript: (update: PresenterSpeechTranscriptUpdate) => void;
  recognitionConstructor?: SpeechRecognitionConstructor | undefined;
}

function normalizeTranscriptText(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

function getBrowserSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const candidate = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition;
}

function getSpeechErrorMessage(event: SpeechRecognitionErrorEventLike) {
  if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
    return 'Microphone permission is required for live transcription.';
  }
  if (event.error === 'no-speech') return undefined;
  return event.message || (event.error ? `Speech recognition failed: ${event.error}` : undefined);
}

export class PresenterSpeechTranscriber {
  private finalParts: string[] = [];
  private lastFinalizedText = '';
  private lastText = '';
  private processedFinalResultIndexes = new Set<number>();
  private recognition: SpeechRecognitionLike | undefined;
  private restartTimeoutId: number | undefined;
  private shouldRestart = false;
  private stopResolver: (() => void) | undefined;

  constructor(private readonly options: PresenterSpeechTranscriberOptions) {}

  getText() {
    return this.lastText;
  }

  start(languageCode: string | undefined) {
    this.startRecognition(languageCode);
  }

  async setLanguage(languageCode: string | undefined) {
    if (!this.recognition) return;
    if (this.recognition.lang === (languageCode || 'en')) return;
    await this.stop();
    this.startRecognition(languageCode);
  }

  stop() {
    this.shouldRestart = false;
    if (this.restartTimeoutId !== undefined) {
      window.clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = undefined;
    }
    const recognition = this.recognition;
    if (!recognition) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        this.stopResolver = undefined;
        this.recognition = undefined;
        resolve();
      }, 1000);
      this.stopResolver = () => {
        window.clearTimeout(timeoutId);
        this.stopResolver = undefined;
        this.recognition = undefined;
        resolve();
      };
      try {
        recognition.stop();
      } catch {
        recognition.abort();
        this.stopResolver();
      }
    });
  }

  private startRecognition(languageCode: string | undefined) {
    const RecognitionConstructor =
      this.options.recognitionConstructor ?? getBrowserSpeechRecognitionConstructor();
    if (!RecognitionConstructor) {
      throw new Error('Web Speech API is not supported by this browser.');
    }

    const recognition = new RecognitionConstructor();
    this.processedFinalResultIndexes = new Set<number>();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageCode || 'en';
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => this.handleResult(event);
    recognition.onerror = (event) => {
      const message = getSpeechErrorMessage(event);
      if (message) this.options.onError?.(message);
    };
    recognition.onend = () => {
      this.stopResolver?.();
      if (!this.shouldRestart) return;
      this.restartTimeoutId = window.setTimeout(() => this.restartRecognition(), 250);
    };

    this.recognition = recognition;
    this.shouldRestart = true;
    recognition.start();
  }

  private restartRecognition() {
    if (!this.shouldRestart || !this.recognition) return;
    try {
      this.recognition.start();
    } catch {
      this.restartTimeoutId = window.setTimeout(() => this.restartRecognition(), 500);
    }
  }

  private handleResult(event: SpeechRecognitionResultEventLike) {
    const interimParts: string[] = [];
    let receivedFinal = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = normalizeTranscriptText(result?.[0]?.transcript ?? '');
      if (!transcript || !result) continue;
      if (result.isFinal) {
        if (!this.processedFinalResultIndexes.has(index)) {
          this.processedFinalResultIndexes.add(index);
          this.finalParts.push(transcript);
        }
        receivedFinal = true;
      } else {
        interimParts.push(transcript);
      }
    }

    const text = normalizeTranscriptText([...this.finalParts, ...interimParts].join(' '));
    const final = receivedFinal && interimParts.length === 0;
    if (!text) return;
    if (text === this.lastText && (!final || text === this.lastFinalizedText)) return;
    this.lastText = text;
    if (final) this.lastFinalizedText = text;
    this.options.onTranscript({ final, text });
  }
}
