import type {
  Page as SlidePage,
  ProjectDocument,
} from '../../../apps/editor/src/domain/documents/model';

import { presenterRouteElements } from './presenter-route-elements';
import { presenterRouteSlide } from './presenter-route-slide';

const proofImageUrl =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22320%22%20height%3D%22180%22%3E%3Crect%20width%3D%22320%22%20height%3D%22180%22%20fill%3D%22%232E6B57%22%2F%3E%3Ctext%20x%3D%2224%22%20y%3D%2296%22%20fill%3D%22white%22%20font-size%3D%2228%22%3EProof%3C%2Ftext%3E%3C%2Fsvg%3E';
const audioUrl =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

export const presenterRouteProject = {
  create(): ProjectDocument {
    const pages: SlidePage[] = [
      presenterRouteSlide.create({
        background: { type: 'color', color: '#111827' },
        elementIds: ['headline-1', 'shape-1'],
        id: 'slide-1',
        name: 'Opening',
        speakerNotes: 'Open with the metric.',
      }),
      presenterRouteSlide.create({
        background: { type: 'asset', assetId: 'asset-proof', colorFallback: '#163B33' },
        elementIds: ['image-2', 'body-2', 'shape-2'],
        id: 'slide-2',
        name: 'Visual proof',
        speakerNotes: 'Point to the before and after visual.',
      }),
      presenterRouteSlide.create({
        background: { type: 'color', color: '#F8FAF7' },
        elementIds: ['hidden-3', 'shape-3'],
        id: 'slide-3',
        name: 'Close',
        speakerNotes: '',
      }),
    ];
    return {
      assets: {
        'asset-proof': {
          id: 'asset-proof',
          mimeType: 'image/svg+xml',
          name: 'Proof graphic',
          objectUrl: proofImageUrl,
          type: 'image',
        },
      },
      createdAt: '2026-07-09T00:00:00.000Z',
      elements: {
        'body-2': presenterRouteElements.createText(
          'body-2',
          'Before and after comparison',
          260,
          500,
        ),
        'headline-1': presenterRouteElements.createText('headline-1', 'Launch readout', 180, 160),
        'hidden-3': {
          ...presenterRouteElements.createText('hidden-3', 'Hidden note', 200, 200),
          visible: false,
        },
        'image-2': presenterRouteElements.createImage('image-2', 'asset-proof', 140, 180),
        'shape-1': presenterRouteElements.createShape('shape-1', '#F2C94C', 240, 420),
        'shape-2': presenterRouteElements.createShape('shape-2', '#C6F6D5', 1120, 190),
        'shape-3': presenterRouteElements.createShape('shape-3', '#334155', 300, 260),
      },
      id: 'presenter-e2e-project',
      name: 'Presenter route deck',
      pages,
      recordings: {
        'route-recording': {
          id: 'route-recording',
          name: 'Launch readout audio',
          createdAt: '2026-07-09T00:05:00.000Z',
          updatedAt: '2026-07-09T00:05:00.000Z',
          durationMs: 24_000,
          language: 'en',
          modelPresetId: 'whisper-base',
          audio: {
            mimeType: 'audio/wav',
            objectUrl: audioUrl,
            storage: 'inline',
          },
          segments: [
            {
              id: 'route-segment-1',
              text: 'Open with the launch readout.',
              startMs: 0,
              endMs: 7_500,
              final: true,
              pageId: 'slide-1',
              pageIndex: 0,
              pageName: 'Opening',
            },
            {
              id: 'route-segment-2',
              text: 'Show the visual proof.',
              startMs: 8_000,
              endMs: 15_500,
              final: true,
              pageId: 'slide-2',
              pageIndex: 1,
              pageName: 'Visual proof',
            },
            {
              id: 'route-segment-3',
              text: 'Close the story.',
              startMs: 16_000,
              endMs: 24_000,
              final: true,
              pageId: 'slide-3',
              pageIndex: 2,
              pageName: 'Close',
            },
          ],
        },
      },
      updatedAt: '2026-07-09T00:00:00.000Z',
    };
  },
};
