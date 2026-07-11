import type { StockMediaItem } from '../../../../src/services/contracts/interfaces';

const modelStates = [
  {
    id: 'image-editing-models',
    label: 'Image Editing Models',
    description: 'Segmentation model for image editing.',
    provider: 'transformers' as const,
    status: 'needs-download' as const,
    progress: 0,
    required: true,
  },
];

const stockImage: StockMediaItem = {
  id: 'photo-1',
  provider: 'unsplash',
  kind: 'image',
  title: 'Mountain sunset',
  authorName: 'Ada Photo',
  thumbnailUrl: 'https://images.unsplash.com/photo-1?w=400',
  mediaUrl: 'https://images.unsplash.com/photo-1?w=1080',
  width: 1200,
  height: 800,
  downloadLocation: 'https://api.unsplash.com/photos/photo-1/download',
};

const stockGif: StockMediaItem = {
  id: 'gif-1',
  provider: 'giphy',
  kind: 'gif',
  title: 'Launch GIF',
  authorName: 'Motion Studio',
  thumbnailUrl: 'https://media.giphy.com/media/gif-1/200w.gif',
  mediaUrl: 'https://media.giphy.com/media/gif-1/giphy.gif',
  width: 480,
  height: 270,
};

function createStockImages(count: number): StockMediaItem[] {
  return Array.from({ length: count }, (_, index) => {
    const itemNumber = index + 1;
    return {
      id: `photo-${itemNumber}`,
      provider: 'unsplash',
      kind: 'image',
      title: `Mountain sunset ${itemNumber}`,
      authorName: `Photo Author ${itemNumber}`,
      thumbnailUrl: `https://images.unsplash.com/photo-${itemNumber}?w=400`,
      mediaUrl: `https://images.unsplash.com/photo-${itemNumber}?w=1080`,
      width: 1200,
      height: 800,
      downloadLocation: `https://api.unsplash.com/photos/photo-${itemNumber}/download`,
    };
  });
}

export const leftToolPanelTestFixtures = {
  createStockImages,
  modelStates,
  stockGif,
  stockImage,
};
