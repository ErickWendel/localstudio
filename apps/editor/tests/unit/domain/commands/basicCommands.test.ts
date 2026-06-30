import {
  AddElementsCommand,
  AlignElementCommand,
  AddImageElementCommand,
  DeleteElementCommand,
  DeletePageCommand,
  DuplicatePageCommand,
  DuplicateElementCommand,
  RenamePageCommand,
  ReorderPageCommand,
  ReorderElementCommand,
  RemoveAssetCommand,
  ReplaceImageAssetCommand,
  SetPageVisibilityCommand,
  SetZOrderCommand,
  SetElementLockCommand,
  SetElementVisibilityCommand,
  ToggleImageFlipCommand,
  UpdateImageCropCommand,
  UpdateElementFrameCommand,
  UpdateElementFramesCommand,
  UpdateElementStyleCommand,
  UpdatePageBackgroundCommand,
  UpdateTextContentCommand,
  TranslateTextElementsCommand,
} from '../../../../src/domain/commands/basicCommands';
import { createSampleProject } from '../../../../src/domain/sampleProject';

describe('editor commands', () => {
  it('aligns an element to page horizontal center immutably', () => {
    const project = createSampleProject();
    const command = new AlignElementCommand('page-1', 'image-hero', 'horizontal-center');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']?.x).toBe((1920 - 980) / 2);
    expect(project.elements['image-hero']?.x).toBe(55);
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
      x: 1184,
      y: 464,
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

  it('replaces an image asset while preserving its frame and z-order', () => {
    const project = createSampleProject();
    const command = new ReplaceImageAssetCommand('image-hero', {
      id: 'asset-generated-replacement',
      type: 'image',
      name: 'replacement.png',
      mimeType: 'image/png',
      objectUrl: 'blob:replacement',
    });
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']).toMatchObject({
      id: 'image-hero',
      type: 'image',
      assetId: 'asset-generated-replacement',
      x: 55,
      y: 200,
      width: 980,
      height: 735,
      rotation: 0,
    });
    expect(next.pages[0]?.elementIds).toEqual(project.pages[0]?.elementIds);
    expect(next.assets['asset-generated-replacement']).toBeDefined();
    expect(next.assets['asset-hero']).toBeUndefined();
    expect(project.elements['image-hero']).toMatchObject({ type: 'image', assetId: 'asset-hero' });
  });

  it('toggles image horizontal flip immutably', () => {
    const project = createSampleProject();
    const flipped = new ToggleImageFlipCommand('image-hero').execute(project);
    const unflipped = new ToggleImageFlipCommand('image-hero').execute(flipped);

    expect(flipped.elements['image-hero']).toMatchObject({ type: 'image', flipX: true });
    expect(unflipped.elements['image-hero']).toMatchObject({ type: 'image', flipX: false });
    expect(project.elements['image-hero']).not.toHaveProperty('flipX');
  });

  it('updates image crop and frame immutably', () => {
    const project = createSampleProject();
    const next = new UpdateImageCropCommand('image-hero', {
      x: 75,
      width: 880,
      crop: { x: 0.1, y: 0, width: 0.9, height: 1 },
    }).execute(project);

    expect(next.elements['image-hero']).toMatchObject({
      type: 'image',
      x: 75,
      width: 880,
      crop: { x: 0.1, y: 0, width: 0.9, height: 1 },
    });
    expect(project.elements['image-hero']).not.toHaveProperty('crop');
  });

  it('keeps an image asset when deleting an element if the page background still uses it', () => {
    const project = createSampleProject();
    const command = new DeleteElementCommand('page-1', 'image-hero');
    const next = command.execute({
      ...project,
      pages: project.pages.map((page) => ({
        ...page,
        background: { type: 'asset', assetId: 'asset-hero', colorFallback: '#050d10' },
      })),
    });

    expect(next.elements['image-hero']).toBeUndefined();
    expect(next.assets['asset-hero']).toBeDefined();
  });

  it('removes an unused asset from the project', () => {
    const project = createSampleProject();
    project.assets['asset-unused'] = {
      id: 'asset-unused',
      type: 'image',
      name: 'unused.png',
      mimeType: 'image/png',
      fileName: 'unused.png',
      storage: 'file',
    };
    const next = new RemoveAssetCommand('asset-unused').execute(project);

    expect(next.assets['asset-unused']).toBeUndefined();
    expect(project.assets['asset-unused']).toBeDefined();
  });

  it('does not remove an asset that is still referenced', () => {
    const project = createSampleProject();
    const next = new RemoveAssetCommand('asset-hero').execute(project);

    expect(next).toBe(project);
    expect(next.assets['asset-hero']).toBeDefined();
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
      x: 55,
      y: 200,
      width: 980,
      height: 735,
      rotation: 0,
    });
  });

  it('updates multiple element frames in one immutable command', () => {
    const project = createSampleProject();
    const next = new UpdateElementFramesCommand({
      'image-hero': { x: 100, y: 220 },
      'text-title': { x: 1200, y: 460 },
    }).execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']).toMatchObject({ x: 100, y: 220 });
    expect(next.elements['text-title']).toMatchObject({ x: 1200, y: 460 });
    expect(project.elements['image-hero']).toMatchObject({ x: 55, y: 200 });
    expect(project.elements['text-title']).toMatchObject({ x: 1160, y: 440 });
  });

  it('updates text content immutably', () => {
    const project = createSampleProject();
    const command = new UpdateTextContentCommand('text-title', 'Edited headline');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['text-title']).toMatchObject({ text: 'Edited headline' });
    expect(project.elements['text-title']).toMatchObject({ text: 'AI Design Revolution' });
  });

  it('updates text style immutably', () => {
    const project = createSampleProject();
    const next = new UpdateElementStyleCommand('text-title', {
      align: 'left',
      fill: '#ffffff',
      fontSize: 72,
      fontWeight: 900,
      opacity: 0.7,
    }).execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['text-title']).toMatchObject({
      align: 'left',
      fill: '#ffffff',
      fontSize: 72,
      fontWeight: 900,
      opacity: 0.7,
    });
    expect(project.elements['text-title']).toMatchObject({
      align: 'center',
      fill: '#37FD76',
      fontSize: 96,
      opacity: 1,
    });
  });

  it('updates page background immutably', () => {
    const project = createSampleProject();
    const next = new UpdatePageBackgroundCommand('page-1', {
      type: 'color',
      color: '#000000',
    }).execute(project);

    expect(next).not.toBe(project);
    expect(next.pages[0]?.background).toEqual({ type: 'color', color: '#000000' });
    expect(project.pages[0]?.background).toEqual({ type: 'color', color: '#050D10' });
  });

  it('translates multiple unlocked text elements immutably', () => {
    const project = createSampleProject();
    const command = new TranslateTextElementsCommand({
      'text-title': 'Revolucao do Design AI',
      'text-subtitle': 'Automacao criativa local',
    });
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['text-title']).toMatchObject({ text: 'Revolucao do Design AI' });
    expect(next.elements['text-subtitle']).toMatchObject({ text: 'Automacao criativa local' });
    expect(project.elements['text-title']).toMatchObject({ text: 'AI Design Revolution' });
  });

  it('applies translated text layout patches immutably', () => {
    const project = createSampleProject();
    const next = new TranslateTextElementsCommand({
      'text-title': {
        text: 'Revolucion de diseno AI',
        width: 840,
        x: 1040,
      },
    }).execute(project);

    expect(next.elements['text-title']).toMatchObject({
      text: 'Revolucion de diseno AI',
      width: 840,
      x: 1040,
    });
    expect(project.elements['text-title']).toMatchObject({
      text: 'AI Design Revolution',
      fontSize: 96,
      width: 600,
      x: 1160,
    });
  });

  it('skips locked text translations', () => {
    const project = {
      ...createSampleProject(),
      elements: {
        ...createSampleProject().elements,
        'text-title': {
          ...createSampleProject().elements['text-title']!,
          locked: true,
        },
      },
    };
    const next = new TranslateTextElementsCommand({
      'text-title': 'Locked translation',
    }).execute(project);

    expect(next).toBe(project);
    expect(next.elements['text-title']).toMatchObject({ text: 'AI Design Revolution' });
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

  it('adds multiple pasted elements as topmost layers', () => {
    const project = createSampleProject();
    const title = project.elements['text-title']!;
    const subtitle = project.elements['text-subtitle']!;
    const command = new AddElementsCommand('page-1', [
      { ...title, id: 'text-title-pasted', x: title.x + 32, y: title.y + 32 },
      { ...subtitle, id: 'text-subtitle-pasted', x: subtitle.x + 32, y: subtitle.y + 32 },
    ]);
    const next = command.execute(project);

    expect(next.elements['text-title-pasted']).toMatchObject({ x: title.x + 32, y: title.y + 32 });
    expect(next.elements['text-subtitle-pasted']).toMatchObject({ x: subtitle.x + 32, y: subtitle.y + 32 });
    expect(next.pages[0]?.elementIds.slice(-2)).toEqual(['text-title-pasted', 'text-subtitle-pasted']);
    expect(project.elements['text-title-pasted']).toBeUndefined();
  });

  it('duplicates a page with cloned unlocked elements after the source page', () => {
    const project = createSampleProject();
    const next = new DuplicatePageCommand('page-1', 'page-copy', (elementId) => `${elementId}-page-copy`).execute(project);

    expect(next.pages).toHaveLength(2);
    expect(next.pages[1]).toMatchObject({
      id: 'page-copy',
      name: 'Slide 1 copy',
      visible: true,
    });
    expect(next.pages[1]?.elementIds).toEqual([
      'image-hero-page-copy',
      'text-subtitle-page-copy',
      'text-title-page-copy',
    ]);
    expect(next.elements['text-title-page-copy']).toMatchObject({
      id: 'text-title-page-copy',
      text: 'AI Design Revolution',
      locked: false,
    });
    expect(project.pages).toHaveLength(1);
  });

  it('deletes a page, its elements, and orphaned assets while preserving other pages', () => {
    const project = createSampleProject();
    const duplicate = new DuplicatePageCommand('page-1', 'page-copy', (elementId) => `${elementId}-copy`).execute(project);
    const next = new DeletePageCommand('page-1').execute(duplicate);

    expect(next.pages).toHaveLength(1);
    expect(next.pages[0]?.id).toBe('page-copy');
    expect(next.elements['image-hero']).toBeUndefined();
    expect(next.assets['asset-hero']).toBeDefined();
  });

  it('does not delete the last remaining page', () => {
    const project = createSampleProject();
    const next = new DeletePageCommand('page-1').execute(project);

    expect(next).toBe(project);
  });

  it('reorders, renames, and hides pages immutably', () => {
    const project = new DuplicatePageCommand('page-1', 'page-copy', (elementId) => `${elementId}-copy`).execute(
      createSampleProject(),
    );
    const reordered = new ReorderPageCommand('page-copy', 0).execute(project);
    const renamed = new RenamePageCommand('page-copy', 'Launch Slide').execute(reordered);
    const hidden = new SetPageVisibilityCommand('page-copy', false).execute(renamed);

    expect(reordered.pages.map((page) => page.id)).toEqual(['page-copy', 'page-1']);
    expect(renamed.pages[0]?.name).toBe('Launch Slide');
    expect(hidden.pages[0]).toMatchObject({ id: 'page-copy', visible: false });
    expect(project.pages.map((page) => page.id)).toEqual(['page-1', 'page-copy']);
  });
});
