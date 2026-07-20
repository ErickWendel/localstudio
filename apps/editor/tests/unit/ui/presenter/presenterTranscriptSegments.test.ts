import { describe, expect, it } from 'vitest';
import { buildPresenterTranscriptSegments } from '../../../../src/ui/presenter/presenterTranscriptSegments';

describe('buildPresenterTranscriptSegments', () => {
  it('adds slide markers and slices transcript text by slide transition offsets', () => {
    const segments = buildPresenterTranscriptSegments(
      [
        {
          id: 'slide-1-marker',
          pageId: 'slide-1',
          pageIndex: 0,
          pageName: 'Intro',
          startMs: 0,
          textOffset: 0,
        },
        {
          id: 'slide-2-marker',
          pageId: 'slide-2',
          pageIndex: 1,
          pageName: 'Demo',
          startMs: 1800,
          textOffset: 12,
        },
      ],
      {
        currentTimeMs: 3200,
        final: false,
        transcriptText: 'hello intro continuing demo',
      },
    );

    expect(segments).toEqual([
      {
        id: 'slide-1-marker',
        text: '[Slide 1] hello intro',
        startMs: 0,
        endMs: 1800,
        pageId: 'slide-1',
        pageIndex: 0,
        pageName: 'Intro',
        final: true,
      },
      {
        id: 'slide-2-marker',
        text: '[Slide 2] continuing demo',
        startMs: 1800,
        endMs: 3200,
        pageId: 'slide-2',
        pageIndex: 1,
        pageName: 'Demo',
        final: false,
      },
    ]);
  });

  it('keeps an empty slide marker visible before speech starts on that slide', () => {
    const segments = buildPresenterTranscriptSegments(
      [
        {
          id: 'slide-1-marker',
          pageIndex: 0,
          startMs: 0,
          textOffset: 0,
        },
        {
          id: 'slide-2-marker',
          pageIndex: 1,
          startMs: 1000,
          textOffset: 11,
        },
      ],
      {
        currentTimeMs: 1000,
        final: false,
        transcriptText: 'hello intro',
      },
    );

    expect(segments[1]).toMatchObject({
      text: '[Slide 2]',
      startMs: 1000,
      endMs: 1000,
    });
  });
});
