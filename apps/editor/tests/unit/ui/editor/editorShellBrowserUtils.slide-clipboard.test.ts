import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { assetFileUtils } from '../../../../src/services/storage/assetFileUtils';
import { editorShellBrowserUtils } from '../../../../src/ui/editor/browser/editorShellBrowserUtils';
import { slideClipboardMedia } from '../../../../src/ui/editor/browser/slideClipboardMedia';

describe('slide clipboard size cap', () => {
  it('drops an already inlined asset when the slide payload exceeds the clipboard cap', async () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    if (!page) throw new Error('Expected a sample page.');
    const oversizedDataUrl = `data:image/png;base64,${'a'.repeat(16 * 1024 * 1024)}`;

    const prepared = await editorShellBrowserUtils.makeSlideClipboardPayloadTransferable({
      assets: {
        'asset-oversized': {
          id: 'asset-oversized',
          type: 'image',
          name: 'Oversized image',
          mimeType: 'image/png',
          objectUrl: oversizedDataUrl,
        },
        'asset-remote': {
          id: 'asset-remote',
          type: 'image',
          name: 'Remote image',
          mimeType: 'image/png',
          objectUrl: 'https://localstudio.dev/remote.png',
        },
        'asset-blob': {
          id: 'asset-blob',
          type: 'image',
          name: 'Session image',
          mimeType: 'image/png',
          objectUrl: 'blob:https://localstudio.dev/session',
        },
      },
      elements: [],
      page,
    }, () => Promise.reject(new Error('blob unavailable')));

    expect(prepared.omittedMedia).toBe(true);
    expect(prepared.payload.assets['asset-oversized']?.objectUrl).toBe('');
    expect(prepared.payload.assets['asset-remote']?.objectUrl).toBe(
      'https://localstudio.dev/remote.png',
    );
    expect(prepared.payload.assets['asset-blob']?.objectUrl).toBe(
      'blob:https://localstudio.dev/session',
    );
    expect(JSON.stringify(prepared.payload).length).toBeLessThanOrEqual(16 * 1024 * 1024);
  });

  it('keeps a blob over 200MB as a clipboard reference without encoding it', async () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    if (!page) throw new Error('Expected a sample page.');
    const video = new Blob(['video-bytes'], { type: 'video/mp4' });
    Object.defineProperty(video, 'size', { value: 200 * 1024 * 1024 });
    const blobToDataUrl = vi.spyOn(assetFileUtils, 'blobToDataUrl');

    const prepared = await editorShellBrowserUtils.makeSlideClipboardPayloadTransferable(
      {
        assets: {
          'asset-video': {
            id: 'asset-video',
            type: 'video',
            name: 'Large video',
            mimeType: 'video/mp4',
            objectUrl: 'blob:https://localstudio.dev/video',
          },
        },
        elements: [],
        page,
      },
      () => Promise.resolve({ blob: () => Promise.resolve(video) } as Response),
    );

    expect(blobToDataUrl).not.toHaveBeenCalled();
    expect(prepared.omittedMedia).toBe(false);
    expect(prepared.retainedOversizedMedia).toBe(true);
    expect(prepared.payload.assets['asset-video']?.objectUrl).toMatch(/^localstudio-clipboard:/);
    expect(JSON.stringify(prepared.payload).length).toBeLessThanOrEqual(16 * 1024 * 1024);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://localstudio.dev/retained-video');
    expect(
      slideClipboardMedia.resolveSlidePayload(prepared.payload).assets['asset-video']?.objectUrl,
    ).toBe('blob:https://localstudio.dev/retained-video');
  });
});
