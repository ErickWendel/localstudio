export interface PresenterAudioRecorderChunk {
  audioData: Float32Array;
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

interface PcmCapture {
  close: () => void;
  read: () => Float32Array;
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
  private pcmCapture: PcmCapture | undefined;
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
    this.timesliceMs = options.timesliceMs ?? 6000;
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
    this.pcmCapture = this.createPcmCapture(this.stream);
    const mimeType = getSupportedMimeType();
    this.recorder = this.mediaRecorderFactory(this.stream, { mimeType });
    this.startedAtMs = Date.now();
    this.chunkStartedAtMs = this.startedAtMs;
    this.recorder.addEventListener('dataavailable', (event) => {
      if (!event.data.size) return;
      this.chunks.push(event.data);
      const endedAtMs = Date.now();
      this.options.onChunk?.({
        audioData: this.pcmCapture?.read() ?? new Float32Array(),
        blob: event.data,
        durationMs: endedAtMs - this.chunkStartedAtMs,
        endedAtMs,
        startedAtMs: this.chunkStartedAtMs,
      });
      this.chunkStartedAtMs = endedAtMs;
    });
    this.recorder.start(this.timesliceMs);
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

  revokeObjectUrl() {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }

  private stopStream() {
    this.pcmCapture?.close();
    this.pcmCapture = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.recorder = undefined;
  }

  private createPcmCapture(stream: MediaStream): PcmCapture | undefined {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return undefined;
    try {
      const audioContext = new AudioContextConstructor({ sampleRate: 16_000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const mutedOutput = audioContext.createGain();
      const chunks: Float32Array[] = [];
      mutedOutput.gain.value = 0;
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(mutedOutput);
      mutedOutput.connect(audioContext.destination);
      return {
        close: () => {
          processor.disconnect();
          source.disconnect();
          mutedOutput.disconnect();
          void audioContext.close();
        },
        read: () => {
          const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
          const audioData = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of chunks.splice(0)) {
            audioData.set(chunk, offset);
            offset += chunk.length;
          }
          return audioData;
        },
      };
    } catch {
      return undefined;
    }
  }
}
