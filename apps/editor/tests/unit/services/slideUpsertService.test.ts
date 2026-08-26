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

  it('merges batches, sorts z-indexes, and performs explicit deletion', async () => {
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
