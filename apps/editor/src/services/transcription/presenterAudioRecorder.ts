export interface PresenterAudioRecorderChunk {
  blob: Blob;
  durationMs: number;
  endedAtMs: number;
  startedAtMs: number;
}

export interface PresenterAudioRecorderResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

export interface PresenterAudioRecorderOptions {
  getUserMedia?: MediaDevices['getUserMedia'];
  mediaRecorderFactory?: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  onChunk?: (chunk: PresenterAudioRecorderChunk) => void;
  timesliceMs?: number;
}

const preferredMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  return (
    preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ??
    'audio/webm'
  );
}

function createObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

export class PresenterAudioRecorder {
  private readonly getUserMedia: MediaDevices['getUserMedia'];
  private readonly mediaRecorderFactory: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  private readonly timesliceMs: number;
  private chunks: Blob[] = [];
  private chunkStartedAtMs = 0;
  private objectUrl: string | undefined;
  private realtimeChunkIntervalId: number | undefined;
  private recorder: MediaRecorder | undefined;
  private startedAtMs = 0;
  private stream: MediaStream | undefined;

  constructor(private readonly options: PresenterAudioRecorderOptions = {}) {
    this.getUserMedia =
      options.getUserMedia ??
      ((constraints) => navigator.mediaDevices.getUserMedia(constraints));
    this.mediaRecorderFactory =
      options.mediaRecorderFactory ??
      ((stream, recorderOptions) => new MediaRecorder(stream, recorderOptions));
    this.timesliceMs = options.timesliceMs ?? 1000;
  }

  getObjectUrl() {
    return this.objectUrl;
  }

  isRecording() {
    return this.recorder?.state === 'recording';
  }

  pause() {
    if (this.recorder?.state === 'recording') this.recorder.pause();
  }

  resume() {
    if (this.recorder?.state === 'paused') this.recorder.resume();
  }

  async start() {
    this.revokeObjectUrl();
    this.chunks = [];
    this.stream = await this.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    this.recorder = this.mediaRecorderFactory(this.stream, { mimeType });
    this.startedAtMs = Date.now();
    this.chunkStartedAtMs = this.startedAtMs;
    this.recorder.addEventListener('dataavailable', (event) => {
      if (!event.data.size) return;
      this.chunks.push(event.data);
      const endedAtMs = Date.now();
      this.options.onChunk?.({
        blob: event.data,
        durationMs: endedAtMs - this.chunkStartedAtMs,
        endedAtMs,
        startedAtMs: this.chunkStartedAtMs,
      });
      this.chunkStartedAtMs = endedAtMs;
    });
    this.recorder.start();
    this.realtimeChunkIntervalId = window.setInterval(() => {
      if (this.recorder?.state !== 'recording') return;
      if (typeof this.recorder.requestData !== 'function') return;
      this.recorder.requestData();
    }, this.timesliceMs);
  }

  stop() {
    return new Promise<PresenterAudioRecorderResult>((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) {
        reject(new Error('Recorder has not started.'));
        return;
      }

      const mimeType = recorder.mimeType || getSupportedMimeType();
      recorder.addEventListener(
        'stop',
        () => {
          this.stopStream();
          const blob = new Blob(this.chunks, { type: mimeType });
          this.objectUrl = createObjectUrl(blob);
          resolve({
            blob,
            durationMs: Date.now() - this.startedAtMs,
            mimeType,
          });
        },
        { once: true },
      );
      recorder.addEventListener(
        'error',
        () => {
          this.stopStream();
          reject(new Error('Audio recording failed.'));
        },
        { once: true },
      );
      if (recorder.state !== 'inactive') recorder.stop();
    });
  }

  cancel() {
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Ignore recorder shutdown errors while abandoning a failed start.
      }
    }
    this.stopStream();
    this.chunks = [];
  }

  revokeObjectUrl() {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }

  private stopStream() {
    if (this.realtimeChunkIntervalId !== undefined) {
      window.clearInterval(this.realtimeChunkIntervalId);
      this.realtimeChunkIntervalId = undefined;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.recorder = undefined;
  }
}
