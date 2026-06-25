import {
  AlignElementCommand,
  AddImageElementCommand,
  DeleteElementCommand,
  DuplicateElementCommand,
  ReorderElementCommand,
  SetZOrderCommand,
  SetElementLockCommand,
  SetElementVisibilityCommand,
  UpdateElementFrameCommand,
  UpdateTextContentCommand,
} from '../../../../src/domain/commands/basicCommands';
import { createSampleProject } from '../../../../src/domain/sampleProject';

describe('editor commands', () => {
  it('aligns an element to page horizontal center immutably', () => {
    const project = createSampleProject();
    const command = new AlignElementCommand('page-1', 'image-hero', 'horizontal-center');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']?.x).toBe((1920 - 516) / 2);
    expect(project.elements['image-hero']?.x).toBe(702);
  });

  it('brings an element to front by moving its id to the end', () => {
    const project = createSampleProject();
    const command = new SetZOrderCommand('page-1', 'image-hero', 'front');
    const next = command.execute(project);

    expect(next.pages[0]?.elementIds.at(-1)).toBe('image-hero');
  });

  it('duplicates an element as the topmost unlocked copy', () => {
    const project = createSampleProject();
    const command = new DuplicateElementCommand('page-1', 'text-title', 'text-title-copy');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['text-title-copy']).toMatchObject({
      id: 'text-title-copy',
      type: 'text',
      text: 'AI Design Revolution',
      x: 464,
      y: 404,
      locked: false,
    });
    expect(next.pages[0]?.elementIds.at(-1)).toBe('text-title-copy');
    expect(project.elements['text-title-copy']).toBeUndefined();
  });

  it('deletes an element and removes it from z-order', () => {
    const project = createSampleProject();
    const command = new DeleteElementCommand('page-1', 'text-subtitle');
    const next = command.execute(project);

    expect(next.elements['text-subtitle']).toBeUndefined();
    expect(next.pages[0]?.elementIds).not.toContain('text-subtitle');
  });

  it('deletes an image element and its owned asset', () => {
    const project = createSampleProject();
    const command = new DeleteElementCommand('page-1', 'image-hero');
    const next = command.execute(project);

    expect(next.elements['image-hero']).toBeUndefined();
    expect(next.assets['asset-hero']).toBeUndefined();
    expect(next.pages[0]?.elementIds).not.toContain('image-hero');
  });

  it('updates element position, size, and rotation immutably', () => {
    const project = createSampleProject();
    const command = new UpdateElementFrameCommand('image-hero', {
      x: 42,
      y: 84,
      width: 640,
      height: 320,
      rotation: 12,
    });
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']).toMatchObject({
      x: 42,
      y: 84,
      width: 640,
      height: 320,
      rotation: 12,
    });
    expect(project.elements['image-hero']).toMatchObject({
      x: 702,
      y: 347,
      width: 516,
      height: 387,
      rotation: 0,
    });
  });

  it('updates text content immutably', () => {
    const project = createSampleProject();
    const command = new UpdateTextContentCommand('text-title', 'Edited headline');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['text-title']).toMatchObject({ text: 'Edited headline' });
    expect(project.elements['text-title']).toMatchObject({ text: 'AI Design Revolution' });
  });

  it('reorders an element within the page z-order immutably', () => {
    const project = createSampleProject();
    const command = new ReorderElementCommand('page-1', 'image-hero', 2);
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.pages[0]?.elementIds).toEqual([
      'text-subtitle',
      'text-title',
      'image-hero',
    ]);
    expect(project.pages[0]?.elementIds).toEqual([
      'image-hero',
      'text-subtitle',
      'text-title',
    ]);
  });

  it('moves an element forward and backward in z-order immutably', () => {
    const project = createSampleProject();
    const forward = new SetZOrderCommand('page-1', 'image-hero', 'forward').execute(project);
    const backward = new SetZOrderCommand('page-1', 'text-title', 'backward').execute(project);

    expect(forward.pages[0]?.elementIds).toEqual(['text-subtitle', 'image-hero', 'text-title']);
    expect(backward.pages[0]?.elementIds).toEqual(['image-hero', 'text-title', 'text-subtitle']);
    expect(project.pages[0]?.elementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
  });

  it('sets element visibility and lock state immutably', () => {
    const project = createSampleProject();
    const hidden = new SetElementVisibilityCommand('image-hero', false).execute(project);
    const locked = new SetElementLockCommand('image-hero', true).execute(hidden);

    expect(hidden.elements['image-hero']).toMatchObject({ visible: false });
    expect(locked.elements['image-hero']).toMatchObject({ locked: true, visible: false });
    expect(project.elements['image-hero']).toMatchObject({ locked: false, visible: true });
  });

  it('adds an imported image as the topmost layer', () => {
    const project = createSampleProject();
    const command = new AddImageElementCommand('page-1', {
      asset: {
        id: 'asset-imported',
        type: 'image',
        name: 'Imported image',
        mimeType: 'image/png',
        objectUrl: 'data:image/png;base64,abc',
      },
      element: {
        id: 'image-imported',
        type: 'image',
        assetId: 'asset-imported',
        x: 480,
        y: 240,
        width: 960,
        height: 540,
        rotation: 0,
        locked: false,
        opacity: 1,
        visible: true,
      },
    });
    const next = command.execute(project);

    expect(next.assets['asset-imported']).toMatchObject({ objectUrl: 'data:image/png;base64,abc' });
    expect(next.elements['image-imported']).toMatchObject({ assetId: 'asset-imported' });
    expect(next.pages[0]?.elementIds.at(-1)).toBe('image-imported');
    expect(project.assets['asset-imported']).toBeUndefined();
  });
});
