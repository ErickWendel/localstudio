import { ChromePromptService } from '../../../src/services/chromePromptService';

describe('ChromePromptService slide generation', () => {
  afterEach(() => {
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: undefined,
    });
  });

  it('generates validated slide tasks with Prompt API structured output', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify({
      language: 'en',
      page: {
        name: 'Why Web AI Matters',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      ],
    }));
    const destroy = vi.fn();
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({ prompt, destroy }),
      },
    });

    const service = new ChromePromptService();
    const tasks = await service.generateSlideTasksFromPrompt('A slide about Web AI');

    expect(tasks.page.name).toBe('Why Web AI Matters');
    expect(tasks.tasks).toHaveLength(2);
    expect(prompt.mock.calls[0]?.[0]).toContain('small ordered task list');
    const taskPromptOptions = prompt.mock.calls[0]?.[1] as { responseConstraint?: { type?: string } };
    expect(taskPromptOptions.responseConstraint?.type).toBe('object');
    expect(destroy).toHaveBeenCalled();
  });

  it('generates one validated element for a task', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify({
      type: 'text',
      id: 'title',
      text: 'Why Web AI Matters',
      x: 960,
      y: 310,
      width: 760,
      height: 160,
      rotation: 0,
      opacity: 1,
      fontFamily: 'Orbitron',
      fontSize: 76,
      fontWeight: 800,
      fill: '#37FD76',
      align: 'center',
    }));
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
      },
    });

    const service = new ChromePromptService();
    const element = await service.generateSlideElementFromTask(
      { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      {
        userPrompt: 'A slide about Web AI',
        allTasks: [{ type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' }],
        page: {
          name: 'Generated slide',
          width: 1920,
          height: 1080,
          background: { type: 'color', color: '#050D10' },
        },
        existingElements: [],
      },
    );

    expect(element).toMatchObject({ type: 'text', text: 'Why Web AI Matters' });
    expect(prompt.mock.calls[0]?.[0]).toContain('Return one JSON element');
    const elementPromptOptions = prompt.mock.calls[0]?.[1] as { responseConstraint?: { oneOf?: unknown } };
    expect(Array.isArray(elementPromptOptions.responseConstraint?.oneOf)).toBe(true);
  });

  it('normalizes left-image hero layout geometry after Prompt API output', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify({
      type: 'text',
      id: 'title',
      text: 'AI Design Revolution',
      x: 12,
      y: 12,
      width: 120,
      height: 60,
      rotation: 0,
      opacity: 1,
      fontFamily: 'Open Sans',
      fontSize: 32,
      fontWeight: 400,
      fill: '#FFFFFF',
      align: 'left',
    }));
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
      },
    });

    const service = new ChromePromptService();
    const allTasks = [
      {
        type: 'add-placeholder-image',
        id: 'placeholder',
        description: 'Hero placeholder image',
        placementHint: 'hero placeholder image in the left media block',
      },
      {
        type: 'add-title',
        id: 'title',
        text: 'AI Design Revolution',
        placementHint: 'right text block, centered',
      },
    ] as const;
    const element = await service.generateSlideElementFromTask(allTasks[1], {
      userPrompt: 'Create a 16:9 dark LocalStudio.ai slide with the placeholder image expanded large on the left',
      allTasks: [...allTasks],
      page: {
        name: 'Generated slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      existingElements: [],
    });

    expect(element).toMatchObject({
      x: 1180,
      y: 410,
      width: 600,
      height: 190,
      fontFamily: 'Orbitron',
      fontSize: 90,
      fill: '#37FD76',
    });
  });
});
