import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { slideUpsertService } from '../../../src/services/automation/slideUpsertService';

const textElement = {
  elementId: 'title',
  type: 'text' as const,
  frame: { x: 100, y: 100, width: 900, height: 180 },
  zIndex: 2,
  content: { text: 'Agent-native slides' },
  style: {
    fontFamily: 'Orbitron',
    fontSize: 72,
    fontWeight: 800,
    color: '#37FD76',
    align: 'center' as const,
  },
  animations: [{ effect: 'fade' as const, order: 1, durationMs: 500 }],
};

const options = {
  createId: (prefix: string) => `${prefix}-test`,
  resolveMedia: () => Promise.reject(new Error('Unexpected media resolution.')),
};

describe('slideUpsertService', () => {
  it('replaces a slide atomically and preserves exact primitive values', async () => {
    const project = sampleProject.createSampleProject();
    const result = await slideUpsertService.apply(
      project,
      {
        requestId: 'replace-slide-1',
        slideNumber: 1,
        mode: 'replace',
        slide: { name: 'WebMCP', background: { type: 'color', color: '#000000' } },
        elements: [textElement],
      },
      options,
    );

    expect(result.project.pages[0]).toMatchObject({
      name: 'WebMCP',
      elementIds: ['title'],
      background: { type: 'color', color: '#000000' },
    });
    expect(result.project.elements.title).toMatchObject({
      id: 'title',
      text: 'Agent-native slides',
      x: 100,
      y: 100,
      width: 900,
      height: 180,
      fontFamily: 'Orbitron',
    });
    expect(result.project.pages[0]?.animationBuilds).toHaveLength(1);
    expect(result.deletedElements).toBe(3);
  });

  it('merges batches and performs explicit deletion', async () => {
    const project = sampleProject.createBlankProject();
    const first = await slideUpsertService.apply(
      project,
      {
        requestId: 'chunk-1',
        slideNumber: 1,
        mode: 'merge',
        elements: [textElement],
      },
      options,
    );
    const second = await slideUpsertService.apply(
      first.project,
      {
        requestId: 'chunk-2',
        slideNumber: 1,
        mode: 'merge',
        elements: [
          {
            ...textElement,
            elementId: 'subtitle',
            zIndex: 1,
            content: { text: 'Bounded second batch' },
            animations: [],
          },
        ],
        deleteElementIds: ['title'],
      },
      options,
    );

    expect(second.project.pages[0]?.elementIds).toEqual(['subtitle']);
    expect(second.project.elements.title).toBeUndefined();
    expect(second.deletedElements).toBe(1);
  });

  it('orders multiple elements and animation builds by their explicit order', async () => {
    const project = sampleProject.createBlankProject();
    const result = await slideUpsertService.apply(
      project,
      {
        requestId: 'ordered-elements',
        slideNumber: 1,
        mode: 'replace',
        elements: [
          {
            ...textElement,
            zIndex: 5,
            animations: [{ effect: 'fade' as const, order: 4 }],
          },
          {
            ...textElement,
            elementId: 'subtitle',
            zIndex: 1,
            animations: [{ effect: 'wipe' as const, order: 2 }],
          },
        ],
      },
      options,
    );

    expect(result.project.pages[0]?.elementIds).toEqual(['subtitle', 'title']);
    expect(result.project.pages[0]?.animationBuilds).toMatchObject([
      { elementId: 'subtitle', effect: 'wipe', order: 2 },
      { elementId: 'title', effect: 'fade', order: 4 },
    ]);
  });

  it('counts only elements actually removed during a replace', async () => {
    const project = sampleProject.createBlankProject();
    const first = await slideUpsertService.apply(
      project,
      {
        requestId: 'initial-stable-element',
        slideNumber: 1,
        mode: 'replace',
        elements: [textElement],
      },
      options,
    );

    const result = await slideUpsertService.apply(
      first.project,
      {
        requestId: 'replace-stable-element',
        slideNumber: 1,
        mode: 'replace',
        elements: [{ ...textElement, content: { text: 'Updated title' } }],
      },
      options,
    );

    expect(result).toMatchObject({
      createdElements: 0,
      updatedElements: 1,
      deletedElements: 0,
      elementCount: 1,
    });
  });

  it('maps shape and media primitives with their exact native properties', async () => {
    const project = sampleProject.createBlankProject();
    const resolveMedia = vi.fn(
      (
        _content: { assetId?: string; url?: string; mediaRef?: string },
        context: { elementId: string; type: 'gif' | 'image' | 'video' },
      ) =>
        Promise.resolve({
          id: `asset-${context.elementId}`,
          type: context.type,
          name: context.elementId,
          mimeType:
            context.type === 'video'
              ? ('video/mp4' as const)
              : context.type === 'gif'
                ? ('image/gif' as const)
                : ('image/png' as const),
          objectUrl: `https://example.test/${context.elementId}`,
          storage: 'remote' as const,
        }),
    );
    const frame = { x: 10, y: 20, width: 300, height: 200 };
    const result = await slideUpsertService.apply(
      project,
      {
        requestId: 'native-primitives',
        slideNumber: 1,
        mode: 'replace',
        elements: [
          {
            elementId: 'shape',
            type: 'shape',
            frame,
            zIndex: 0,
            rotation: 15,
            opacity: 0.7,
            visible: false,
            locked: true,
            content: { shape: 'rounded-rect', fill: '#123456', stroke: '#abcdef', strokeWidth: 3 },
          },
          {
            elementId: 'image',
            type: 'image',
            frame,
            zIndex: 1,
            content: { url: 'https://example.test/image.png' },
            crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
            flipX: true,
            mask: 'ellipse',
          },
          {
            elementId: 'gif',
            type: 'gif',
            frame,
            zIndex: 2,
            content: { url: 'https://example.test/animation.gif' },
            playing: false,
          },
          {
            elementId: 'video',
            type: 'video',
            frame,
            zIndex: 3,
            content: { url: 'https://example.test/video.mp4' },
            playback: {
              loop: true,
              controls: false,
              muted: true,
              autoplayInPreview: true,
              trimStartSeconds: 2,
              trimEndSeconds: 8,
              playAcrossSlides: true,
              startOnClick: true,
              volume: 0.4,
            },
          },
        ],
      },
      { ...options, resolveMedia },
    );

    expect(result.project.elements.shape).toMatchObject({
      type: 'shape',
      shape: 'rounded-rect',
      fill: '#123456',
      stroke: '#abcdef',
      strokeWidth: 3,
      rotation: 15,
      opacity: 0.7,
      visible: false,
      locked: true,
    });
    expect(result.project.elements.image).toMatchObject({
      type: 'image',
      assetId: 'asset-image',
      crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
      flipX: true,
      mask: 'ellipse',
    });
    expect(result.project.elements.gif).toMatchObject({
      type: 'gif',
      assetId: 'asset-gif',
      playing: false,
    });
    expect(result.project.elements.video).toMatchObject({
      type: 'video',
      assetId: 'asset-video',
      loop: true,
      controls: false,
      muted: true,
      autoplayInPreview: true,
      trimStartSeconds: 2,
      trimEndSeconds: 8,
      playAcrossSlides: true,
      startOnClick: true,
      volume: 0.4,
    });
    expect(resolveMedia).toHaveBeenCalledTimes(3);
  });

  it('rejects the complete batch before mutation when IDs collide across slides', async () => {
    const project = sampleProject.createBlankProject();
    const withSecondSlide = await slideUpsertService.apply(
      project,
      {
        requestId: 'new-slide',
        slideNumber: 2,
        mode: 'replace',
        elements: [textElement],
      },
      options,
    );

    await expect(
      slideUpsertService.apply(
        withSecondSlide.project,
        {
          requestId: 'collision',
          slideNumber: 1,
          mode: 'merge',
          elements: [textElement],
        },
        options,
      ),
    ).rejects.toThrow('belongs to another slide');
    expect(withSecondSlide.project.pages[0]?.elementIds).toEqual([]);
  });

  it('rejects attempts to create a slide after a positional gap', async () => {
    const project = sampleProject.createBlankProject();

    await expect(
      slideUpsertService.apply(
        project,
        {
          requestId: 'slide-gap',
          slideNumber: 3,
          mode: 'replace',
          elements: [],
        },
        options,
      ),
    ).rejects.toThrow('cannot contain gaps');
    expect(project.pages).toHaveLength(1);
  });

  it('validates explicit deletion before resolving any media', async () => {
    const project = sampleProject.createBlankProject();
    const resolveMedia = vi.fn(() => Promise.reject(new Error('must not run')));

    await expect(
      slideUpsertService.apply(
        project,
        {
          requestId: 'atomic-validation',
          slideNumber: 1,
          mode: 'merge',
          deleteElementIds: ['missing'],
          elements: [
            {
              elementId: 'image',
              type: 'image',
              frame: { x: 0, y: 0, width: 100, height: 100 },
              zIndex: 0,
              content: { url: 'https://example.test/image.png' },
            },
          ],
        },
        { ...options, resolveMedia },
      ),
    ).rejects.toThrow('does not belong');
    expect(resolveMedia).not.toHaveBeenCalled();
    expect(project.pages[0]?.elementIds).toEqual([]);
  });
});
