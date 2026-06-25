import type { ProjectDocument } from './model';
import { fitImageWithinPage } from './imageSizing';

export const SAMPLE_HERO_IMAGE_URL =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRe1Oh1Q3hIcQYKNHc_GwRcQnT6uSgL02RVLBpt4tWMfYKZ2Ja97objCe8&s=10';
export const SAMPLE_HERO_IMAGE_SIZE = fitImageWithinPage({
  imageWidth: 516,
  imageHeight: 387,
  pageWidth: 1920,
  pageHeight: 1080,
});

export function createSampleProject(): ProjectDocument {
  const now = new Date('2026-06-24T00:00:00.000Z').toISOString();

  return {
    id: 'project-1',
    name: 'Untitled AI Deck',
    createdAt: now,
    updatedAt: now,
    assets: {
      'asset-hero': {
        id: 'asset-hero',
        type: 'image',
        name: 'Futuristic landscape',
        mimeType: 'image/png',
        objectUrl: SAMPLE_HERO_IMAGE_URL,
      },
    },
    pages: [
      {
        id: 'page-1',
        name: 'Slide 1',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: ['image-hero', 'text-subtitle', 'text-title'],
      },
    ],
    elements: {
      'image-hero': {
        id: 'image-hero',
        type: 'image',
        assetId: 'asset-hero',
        x: SAMPLE_HERO_IMAGE_SIZE.x,
        y: SAMPLE_HERO_IMAGE_SIZE.y,
        width: SAMPLE_HERO_IMAGE_SIZE.width,
        height: SAMPLE_HERO_IMAGE_SIZE.height,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
      },
      'text-subtitle': {
        id: 'text-subtitle',
        type: 'text',
        text: 'Browser-native creative automation',
        x: 580,
        y: 690,
        width: 760,
        height: 80,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        fontFamily: 'Open Sans',
        fontSize: 40,
        fontWeight: 600,
        fill: '#FFFFFF',
        align: 'center',
      },
      'text-title': {
        id: 'text-title',
        type: 'text',
        text: 'AI Design Revolution',
        x: 440,
        y: 380,
        width: 1040,
        height: 240,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        fontFamily: 'Orbitron',
        fontSize: 96,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      },
    },
  };
}
