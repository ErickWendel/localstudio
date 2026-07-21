import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresenterAudioRecorder } from '../../../src/services/transcription/presenterAudioRecorder';

class FakeMediaRecorder extends EventTarget {
  static supportedMimeType = 'audio/webm;codecs=opus';
  static isTypeSupported(mimeType: string) {
    return mimeType === FakeMediaRecorder.supportedMimeType;
  }

  readonly mimeType: string;
  state: RecordingState = 'inactive';

  constructor(
    readonly stream: MediaStream,
    options: MediaRecorderOptions,
  ) {
    super();
    this.mimeType = options.mimeType ?? 'audio/webm';
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  start() {
    this.state = 'recording';
    this.dispatchAudioChunk('hello');
  }

  stop() {
    this.state = 'inactive';
    this.dispatchAudioChunk(' world');
    this.dispatchEvent(new Event('stop'));
  }

  private dispatchAudioChunk(text: string) {
    const event = new Event('dataavailable') as Event & { data: Blob };
    Object.defineProperty(event, 'data', {
      value: new Blob([text], { type: this.mimeType }),
    });
    this.dispatchEvent(event);
  }
}

function createStream() {
  return {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
}

describe('PresenterAudioRecorder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records chunks, stops the stream, and exposes a saved audio object URL', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const chunks: Blob[] = [];
    const recorder = new PresenterAudioRecorder({
      getUserMedia: () => Promise.resolve(createStream()),
      onChunk: (chunk) => {
        chunks.push(chunk.blob);
      },
    });

    await recorder.start();
    const result = await recorder.stop();

    expect(result.mimeType).toBe('audio/webm;codecs=opus');
    expect(await result.blob.text()).toBe('hello world');
    expect(await Promise.all(chunks.map((chunk) => chunk.text()))).toEqual(['hello', ' world']);
    expect(recorder.getObjectUrl()).toBe('blob:recording');
    expect(createObjectUrl).toHaveBeenCalled();
  });

  it('surfaces microphone permission failures', async () => {
    const recorder = new PresenterAudioRecorder({
      getUserMedia: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
    });

    await expect(recorder.start()).rejects.toThrow('Denied');
  });
});
