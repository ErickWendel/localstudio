import { describe, expect, it } from 'vitest';
import { presenterRemoteProtocol } from '@localstudio/presenter-remote/protocol';
import { presenterRemoteSessionCode } from '@localstudio/presenter-remote/session-code';

describe('presenter remote protocol', () => {
  it('accepts known remote commands and rejects malformed commands', () => {
    expect(presenterRemoteProtocol.isCommand({ type: 'command', command: 'next' })).toBe(true);
    expect(
      presenterRemoteProtocol.isCommand({ type: 'command', command: 'start-presenting' }),
    ).toBe(true);
    expect(
      presenterRemoteProtocol.isCommand({
        type: 'command',
        command: 'go-to-page',
        pageId: 'page-2',
      }),
    ).toBe(true);
    expect(
      presenterRemoteProtocol.isCommand({
        type: 'command',
        command: 'update-notes',
        notes: 'Opening thought',
        pageId: 'page-1',
      }),
    ).toBe(true);

    expect(presenterRemoteProtocol.isCommand({ type: 'command', command: 'delete-page' })).toBe(
      false,
    );
    expect(presenterRemoteProtocol.isCommand({ type: 'command', command: 'go-to-page' })).toBe(
      false,
    );
    expect(presenterRemoteProtocol.isCommand(null)).toBe(false);
  });

  it('accepts complete presenter state and rejects incomplete state', () => {
    expect(
      presenterRemoteProtocol.isState({
        activePageId: 'page-1',
        activePageIndex: 0,
        buildsRemaining: 2,
        connectedControllerCount: 1,
        deckName: 'Demo deck',
        notes: '',
        pageCount: 24,
        pages: [
          {
            id: 'page-1',
            name: 'Intro',
            preview: {
              backgroundColor: '#050D10',
              elements: [],
              height: 1080,
              width: 1920,
            },
          },
        ],
        presenterMode: 'presenting',
        slidePreview: {
          backgroundColor: '#050D10',
          elements: [
            {
              align: 'left',
              fill: '#FFFFFF',
              fontFamily: 'Open Sans',
              fontSize: 64,
              fontWeight: 800,
              height: 120,
              id: 'title',
              kind: 'text',
              opacity: 1,
              rotation: 0,
              text: 'Demo',
              width: 800,
              x: 120,
              y: 120,
            },
            {
              assetUrl: 'https://cdn.localstudio.test/demo.mp4',
              autoplay: true,
              controls: true,
              height: 300,
              id: 'video-1',
              kind: 'media',
              loop: true,
              mediaType: 'video',
              muted: true,
              opacity: 1,
              rotation: 0,
              width: 520,
              x: 100,
              y: 400,
            },
          ],
          height: 1080,
          width: 1920,
        },
        shortcuts: ['next', 'previous'],
        timer: { elapsedMs: 1200, paused: false },
        type: 'state',
        upcomingSlidePreviews: [
          {
            pageId: 'page-2',
            pageName: 'Next',
            preview: {
              backgroundColor: '#111111',
              elements: [],
              height: 1080,
              width: 1920,
            },
          },
        ],
      }),
    ).toBe(true);

    expect(
      presenterRemoteProtocol.isState({
        activePageIndex: 0,
        pageCount: 24,
        type: 'state',
      }),
    ).toBe(false);

    expect(
      presenterRemoteProtocol.isState({
        activePageId: 'page-1',
        activePageIndex: 0,
        buildsRemaining: 0,
        connectedControllerCount: 1,
        deckName: 'Demo deck',
        notes: '',
        pageCount: 1,
        presenterMode: 'presenting',
        slidePreview: {
          backgroundColor: '#050D10',
          elements: [{ id: 'bad', kind: 'text' }],
          height: 1080,
          width: 1920,
        },
        shortcuts: [],
        timer: { elapsedMs: 0, paused: false },
        type: 'state',
      }),
    ).toBe(false);
  });

  it('normalizes human session codes and rejects ambiguous codes', () => {
    expect(presenterRemoteSessionCode.normalize(' abcd-1234 ')).toBe('ABCD-1234');
    expect(presenterRemoteSessionCode.isValid('ABCD-1234')).toBe(true);
    expect(presenterRemoteSessionCode.isValid('ABC-1234')).toBe(false);
    expect(presenterRemoteSessionCode.isValid('ABCO-1234')).toBe(false);
  });
});
