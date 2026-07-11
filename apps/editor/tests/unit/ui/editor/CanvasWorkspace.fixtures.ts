import type { ProjectDocument, ShapeElement, VideoElement } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';

const shapeCatalog: ShapeElement['shape'][] = [
  'ellipse',
  'line',
  'rect',
  'rounded-rect',
  'triangle',
  'pentagon',
  'diamond',
  'parallelogram',
  'arrow',
  'arc',
];

function createMediaProject(): ProjectDocument {
  const project = sampleProject.createSampleProject();
  project.assets['asset-video'] = {
    id: 'asset-video',
    type: 'video',
    name: 'Demo clip',
    mimeType: 'video/mp4',
    objectUrl: 'blob:video',
  };
  project.assets['asset-gif'] = {
    id: 'asset-gif',
    type: 'gif',
    name: 'Animated loop',
    mimeType: 'image/gif',
    objectUrl: 'blob:gif',
  };
  project.elements['video-demo'] = {
    id: 'video-demo',
    type: 'video',
    assetId: 'asset-video',
    x: 120,
    y: 80,
    width: 640,
    height: 360,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    loop: true,
    repeatMode: 'loop',
    controls: true,
    muted: true,
    autoplayInPreview: true,
    trimStartSeconds: 2,
    trimEndSeconds: 6,
    durationSeconds: 12,
    volume: 0.75,
  };
  project.elements['gif-demo'] = {
    id: 'gif-demo',
    type: 'gif',
    assetId: 'asset-gif',
    x: 220,
    y: 180,
    width: 320,
    height: 180,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    playing: true,
  };
  project.pages[0]?.elementIds.push('video-demo', 'gif-demo');
  return project;
}

function updateVideoElement(
  project: ProjectDocument,
  patch: Partial<VideoElement>,
): ProjectDocument {
  const videoElement = project.elements['video-demo'];
  if (videoElement?.type !== 'video') {
    throw new Error('Expected video-demo test fixture to be a video element.');
  }
  return {
    ...project,
    elements: {
      ...project.elements,
      'video-demo': {
        ...videoElement,
        ...patch,
      },
    },
  };
}

export const canvasWorkspaceTestFixtures = {
  createMediaProject,
  shapeCatalog,
  updateVideoElement,
};
