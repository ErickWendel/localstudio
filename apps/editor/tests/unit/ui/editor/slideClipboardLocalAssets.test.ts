import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../../../../src/domain/documents/model';
import { materializeSlideClipboardAssets } from '../../../../src/ui/editor/persistence/slideClipboardLocalAssets';

const imageAsset: Asset = {
  id: 'asset-hero',
  type: 'image',
  name: 'Hero',
  mimeType: 'image/png',
  objectUrl: 'data:image/png;base64,aGVyby1ieXRlcw==',
};

describe('materializeSlideClipboardAssets', () => {
  it('stores an inlined clipboard image as a local file before cloud sync', async () => {
    const materialize = vi.fn((fileName: string) =>
      Promise.resolve({
        fileName: `stored-${fileName}`,
        objectUrl: 'blob:stored-hero',
      }),
    );

    const payload = await materializeSlideClipboardAssets(
      {
        assets: { 'asset-hero': imageAsset },
        elements: [],
        page: {
          id: 'page-1',
          name: 'Slide 1',
          width: 1920,
          height: 1080,
          background: { type: 'color', color: '#000000' },
          elementIds: [],
        },
      },
      materialize,
    );

    expect(materialize).toHaveBeenCalledWith('asset-hero.png', expect.any(Blob));
    expect(payload).toMatchObject({
      assets: {
        'asset-hero': {
          fileName: 'stored-asset-hero.png',
          objectUrl: 'blob:stored-hero',
          storage: 'file',
        },
      },
    });
  });
});
