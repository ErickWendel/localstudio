import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresenterTranscriptWindow } from '../../../../src/ui/presenter/PresenterTranscriptWindow';

type BroadcastHandler = ((event: MessageEvent<unknown>) => void) | null;

describe('PresenterTranscriptWindow', () => {
  const channels: MockBroadcastChannel[] = [];
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let scrollIntoViewDescriptor: PropertyDescriptor | undefined;

  class MockBroadcastChannel {
    onmessage: BroadcastHandler = null;

    constructor(public readonly name: string) {
      channels.push(this);
    }

    postMessage = vi.fn();
    close = vi.fn();

    emit(data: unknown) {
      this.onmessage?.({ data } as MessageEvent<unknown>);
    }
  }

  beforeEach(() => {
    channels.length = 0;
    scrollIntoView = vi.fn();
    scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (scrollIntoViewDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('renders incoming slide-marked transcript updates and scrolls to the latest text', () => {
    render(<PresenterTranscriptWindow sessionId="session-1" />);

    expect(channels[0]?.name).toBe('localstudio-presenter-transcript-session-1');
    expect(channels[0]?.postMessage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      source: 'localstudio-presenter-transcript-window',
      type: 'ready',
    });

    scrollIntoView.mockClear();
    act(() => {
      channels[0]?.emit({
        segments: [
          {
            id: 'segment-1',
            text: '[Slide 1] Opening remarks.',
            startMs: 0,
            endMs: 1200,
            pageIndex: 0,
            final: true,
          },
          {
            id: 'segment-2',
            text: '[Slide 2] Follow-up details.',
            startMs: 1200,
            endMs: 2400,
            pageIndex: 1,
            final: false,
          },
        ],
        sessionId: 'session-1',
        source: 'localstudio-presenter-transcript',
        status: 'recording',
        type: 'state',
      });
    });

    expect(screen.getByLabelText('Transcription status recording')).toBeInTheDocument();
    expect(screen.getByText('Slide 1')).toBeInTheDocument();
    expect(screen.getByText('Opening remarks.')).toBeInTheDocument();
    expect(screen.getByText('Slide 2')).toBeInTheDocument();
    expect(screen.getByText('Follow-up details.')).toBeInTheDocument();
    expect(screen.queryByText('[Slide 1] Opening remarks.')).not.toBeInTheDocument();
    expect(screen.queryByText('[Slide 2] Follow-up details.')).not.toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'end' });
  });
});
