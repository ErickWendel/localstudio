import { applyGeneratedSlideCommand } from '../../../../src/domain/commands/generated-slides/applyGeneratedSlideCommand';
import type { ImageElement } from '../../../../src/domain/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';

describe('generated slide commands', () => {
  it('prepares the active page by clearing current page elements and applying page metadata', () => {
    const project = sampleProject.createSampleProject();
    const next = new applyGeneratedSlideCommand.PrepareGeneratedSlideCommand('page-1', {
      name: 'Why Web AI Matters',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#050D10' },
    }).execute(project);

    expect(next).not.toBe(project);
    expect(next.pages[0]).toMatchObject({
      name: 'Why Web AI Matters',
      background: { type: 'color', color: '#050D10' },
      elementIds: [],
    });
    expect(project.pages[0]?.elementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
  });

  it('appends a generated placeholder image immutably', () => {
    const prepared = new applyGeneratedSlideCommand.PrepareGeneratedSlideCommand('page-1', {
      name: 'Why Web AI Matters',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#050D10' },
    }).execute(sampleProject.createSampleProject());

    const next = new applyGeneratedSlideCommand.AddGeneratedSlideElementCommand('page-1', {
      type: 'image',
      id: 'visual',
      assetRole: 'placeholder',
      x: 80,
      y: 240,
      width: 720,
      height: 540,
      rotation: 0,
      opacity: 1,
    }).execute(prepared);

    expect(next.pages[0]?.elementIds).toEqual(['generated-page-1-visual']);
    expect(next.assets['asset-placeholder-web-ai']).toMatchObject({
      id: 'asset-placeholder-web-ai',
      type: 'image',
      name: 'Web AI placeholder image',
      mimeType: 'image/jpeg',
    });
    expect(next.elements['generated-page-1-visual']).toMatchObject({
      type: 'image',
      assetId: 'asset-placeholder-web-ai',
      x: 80,
      y: 240,
    });
  });

  it('appends a generated remote image asset when the element has a remote src', () => {
    const prepared = new applyGeneratedSlideCommand.PrepareGeneratedSlideCommand('page-1', {
      name: 'Remote image',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#050D10' },
    }).execute(sampleProject.createSampleProject());

    const next = new applyGeneratedSlideCommand.AddGeneratedSlideElementCommand('page-1', {
      type: 'image',
      id: 'remote',
      assetRole: 'remote',
      src: 'https://example.com/photo.jpeg',
      x: 80,
      y: 240,
      width: 720,
      height: 540,
      rotation: 0,
      opacity: 1,
    }).execute(prepared);

    const image = next.elements['generated-page-1-remote'] as ImageElement;
    expect(image).toMatchObject({ type: 'image' });
    expect(next.assets[image.assetId]).toMatchObject({
      type: 'image',
      objectUrl: 'https://example.com/photo.jpeg',
      storage: 'remote',
    });
  });
});
