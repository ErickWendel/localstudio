import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../../../../src/domain/generated-slides/generatedSlide';
import { slideLayoutPresets } from '../../../../src/services/prompting/slideLayoutPresets';

const page: GeneratedSlideTasksDocument['page'] = {
  name: 'AI Design Revolution',
  width: 1920,
  height: 1080,
  background: { type: 'color', color: '#050D10' },
};

const tasks: GeneratedSlideTask[] = [
  { type: 'set-background', color: '#050D10' },
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
  {
    type: 'add-subtitle',
    id: 'subtitle',
    text: 'Browser-native creative',
    placementHint: 'below title in the right text block',
  },
];

const gridTasks: GeneratedSlideTask[] = [
  { type: 'set-background', color: '#050D10' },
  {
    type: 'add-title',
    id: 'grid-title',
    text: 'Web AI',
    placementHint: 'top title band',
  },
  {
    type: 'add-placeholder-image',
    id: 'grid-1',
    description: 'Privacy',
    placementHint: 'grid image 1 left',
  },
  {
    type: 'add-placeholder-image',
    id: 'grid-2',
    description: 'Speed',
    placementHint: 'grid image 2 center',
  },
  {
    type: 'add-placeholder-image',
    id: 'grid-3',
    description: 'No Backend',
    placementHint: 'grid image 3 right',
  },
  {
    type: 'add-body-text',
    id: 'caption-1',
    text: 'Private by default',
    placementHint: 'caption below grid image 1',
  },
  {
    type: 'add-body-text',
    id: 'caption-2',
    text: 'Fast local inference',
    placementHint: 'caption below grid image 2',
  },
  {
    type: 'add-body-text',
    id: 'caption-3',
    text: 'No backend required',
    placementHint: 'caption below grid image 3',
  },
];

const twoImageGridTasks: GeneratedSlideTask[] = [
  { type: 'set-background', color: '#050D10' },
  {
    type: 'add-title',
    id: 'two-grid-title',
    text: 'Web AI Choices',
    placementHint: 'top title band',
  },
  {
    type: 'add-placeholder-image',
    id: 'two-grid-1',
    description: 'Local model',
    placementHint: 'grid image 1 left',
  },
  {
    type: 'add-placeholder-image',
    id: 'two-grid-2',
    description: 'Cloud workflow',
    placementHint: 'grid image 2 right',
  },
  {
    type: 'add-body-text',
    id: 'two-caption-1',
    text: 'Runs privately in the browser',
    placementHint: 'caption below grid image 1',
  },
  {
    type: 'add-body-text',
    id: 'two-caption-2',
    text: 'Keeps teams connected',
    placementHint: 'caption below grid image 2',
  },
];

const bulletTasks: GeneratedSlideTask[] = [
  { type: 'set-background', color: '#050D10' },
  {
    type: 'add-title',
    id: 'bullet-title',
    text: 'Why Web AI',
    placementHint: 'top title band',
  },
  {
    type: 'add-bullets',
    id: 'bullets',
    items: ['Private by default', 'Fast local inference', 'No backend required'],
    placementHint: 'body content area',
  },
];

const leftImageBulletTasks: GeneratedSlideTask[] = [
  { type: 'set-background', color: '#050D10' },
  {
    type: 'add-placeholder-image',
    id: 'left-image',
    description: 'Web Search visual',
    placementHint: 'left media block',
  },
  {
    type: 'add-title',
    id: 'mixed-title',
    text: 'Web Search',
    placementHint: 'right text block title',
  },
  {
    type: 'add-bullets',
    id: 'mixed-bullets',
    items: ['My idea', 'His idea', 'Our idea'],
    placementHint: 'right text block bullets',
  },
];

const titleSubtitleTasks: GeneratedSlideTask[] = [
  { type: 'set-background', color: '#2B0A4A' },
  {
    type: 'add-title',
    id: 'color-title',
    text: 'Web AI Advantage',
    placementHint: 'center title color #D4AF37',
  },
  {
    type: 'add-subtitle',
    id: 'color-subtitle',
    text: 'Fast local intelligence',
    placementHint: 'center subtitle color #FFFFFF',
  },
];

function textElement(id: string, text: string): GeneratedSlideElement {
  return {
    type: 'text',
    id,
    text,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    rotation: 0,
    opacity: 1,
    fontFamily: 'Open Sans',
    fontSize: 32,
    fontWeight: 400,
    fill: '#FFFFFF',
    align: 'left',
  };
}

describe('slide layout presets', () => {
  it('pins the placeholder image into the left hero media frame', () => {
    const element: GeneratedSlideElement = {
      type: 'image',
      id: 'placeholder',
      assetRole: 'placeholder',
      x: 0,
      y: 0,
      width: 200,
      height: 120,
      rotation: 0,
      opacity: 1,
    };

    expect(slideLayoutPresets.applySlideElementLayoutPreset(element, { task: tasks[1] as Exclude<GeneratedSlideTask, { type: 'set-background' }>, allTasks: tasks, page })).toMatchObject({
      x: 48,
      y: 195,
      width: 980,
      height: 735,
      rotation: 0,
      opacity: 1,
    });
  });

  it('formats the right-side title and subtitle without changing their text', () => {
    const title = slideLayoutPresets.applySlideElementLayoutPreset(textElement('title', 'AI Design Revolution'), {
      task: tasks[2] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: tasks,
      page,
    });
    const subtitle = slideLayoutPresets.applySlideElementLayoutPreset(textElement('subtitle', 'Browser-native creative'), {
      task: tasks[3] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: tasks,
      page,
    });

    expect(title).toMatchObject({
      text: 'AI Design Revolution',
      x: 1180,
      y: 410,
      width: 600,
      height: 190,
      fontFamily: 'Orbitron',
      fontSize: 90,
      fontWeight: 800,
      fill: '#37FD76',
      align: 'center',
    });
    expect(subtitle).toMatchObject({
      text: 'Browser-native creative',
      x: 1210,
      y: 640,
      width: 560,
      height: 70,
      fontFamily: 'Open Sans',
      fontSize: 40,
      fontWeight: 600,
      fill: '#FFFFFF',
      align: 'center',
    });
  });

  it('keeps placeholder image hero prompts on the left-media right-text layout', () => {
    const normalized = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        language: 'en',
        page,
        tasks,
      },
      'Slide with the placeholder image expanded large on the left, the neon green title “AI Design Revolution” on the right, and the subtitle “Browser-native creative” below it.',
    );

    expect(normalized.tasks).toEqual(tasks);
  });

  it('pins image grid elements into three non-overlapping columns', () => {
    const element: GeneratedSlideElement = {
      type: 'image',
      id: 'grid-2',
      assetRole: 'placeholder',
      x: 0,
      y: 0,
      width: 1600,
      height: 200,
      rotation: 0,
      opacity: 0.5,
    };

    expect(
      slideLayoutPresets.applySlideElementLayoutPreset(element, {
        task: gridTasks[3] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
        allTasks: gridTasks,
        page,
      }),
    ).toMatchObject({
      x: 710,
      y: 300,
      width: 500,
      height: 360,
      rotation: 0,
      opacity: 1,
    });
  });

  it('coerces model-returned shapes into images for image grid placeholder tasks', () => {
    const element: GeneratedSlideElement = {
      type: 'shape',
      id: 'grid-1',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      rotation: 0,
      opacity: 1,
      fill: '#FFFFFF',
    };

    expect(
      slideLayoutPresets.applySlideElementLayoutPreset(element, {
        task: gridTasks[2] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
        allTasks: gridTasks,
        page,
      }),
    ).toEqual({
      type: 'image',
      id: 'grid-1',
      assetRole: 'placeholder',
      x: 120,
      y: 300,
      width: 500,
      height: 360,
      rotation: 0,
      opacity: 1,
    });
  });

  it('pins image grid titles and captions into readable regions', () => {
    const title = slideLayoutPresets.applySlideElementLayoutPreset(textElement('grid-title', 'Web AI'), {
      task: gridTasks[1] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: gridTasks,
      page,
    });
    const caption = slideLayoutPresets.applySlideElementLayoutPreset(textElement('caption-3', 'No backend required'), {
      task: gridTasks[7] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: gridTasks,
      page,
    });

    expect(title).toMatchObject({
      x: 180,
      y: 120,
      width: 1560,
      height: 120,
      fontFamily: 'Orbitron',
      fontSize: 86,
      fill: '#37FD76',
      align: 'center',
    });
    expect(caption).toMatchObject({
      x: 1300,
      y: 700,
      width: 500,
      height: 110,
      fontFamily: 'Open Sans',
      fontSize: 34,
      fill: '#FFFFFF',
      align: 'center',
    });
  });

  it('removes unrequested subtitle-like text from image grid plans', () => {
    const normalized = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        language: 'en',
        page,
        tasks: [
          { type: 'set-background', color: '#050D10' },
          { type: 'add-subtitle', id: 'overview', text: 'Overview of Web AI', placementHint: 'top title band' },
          { type: 'add-title', id: 'title', text: 'Web AI', placementHint: 'top title band' },
          { type: 'add-placeholder-image', id: 'grid-1', description: 'Privacy', placementHint: 'grid image 1 left' },
          { type: 'add-placeholder-image', id: 'grid-2', description: 'Speed', placementHint: 'grid image 2 center' },
          { type: 'add-placeholder-image', id: 'grid-3', description: 'No backend', placementHint: 'grid image 3 right' },
          { type: 'add-body-text', id: 'caption-1', text: 'Private by default', placementHint: 'caption below grid image 1' },
          { type: 'add-body-text', id: 'caption-2', text: 'Fast local inference', placementHint: 'caption below grid image 2' },
          { type: 'add-body-text', id: 'caption-3', text: 'No backend required', placementHint: 'caption below grid image 3' },
        ],
      },
      'Three-image grid about Web AI, with matching captions.',
    );

    expect(normalized).not.toBe(gridTasks);
    expect(normalized.tasks.filter((task) => task.type === 'add-title')).toHaveLength(1);
    expect(normalized.tasks.some((task) => 'text' in task && task.text === 'Overview of Web AI')).toBe(false);
    expect(normalized.tasks.find((task) => task.type === 'add-title')).toMatchObject({
      text: 'Web AI',
      placementHint: 'top title band',
    });
  });

  it('converts shape-based image grid placeholders into real placeholder image tasks', () => {
    const normalized = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        language: 'en',
        page,
        tasks: [
          { type: 'set-background', color: '#050D10' },
          { type: 'add-title', id: 'title', text: 'Web AI', placementHint: 'top title band' },
          { type: 'add-shape', id: 'card-1', shape: 'rect', placementHint: 'grid image 1 left placeholder card' },
          { type: 'add-shape', id: 'card-2', shape: 'rect', placementHint: 'grid image 2 center placeholder card' },
          { type: 'add-shape', id: 'card-3', shape: 'rect', placementHint: 'grid image 3 right placeholder card' },
          { type: 'add-body-text', id: 'caption-1', text: 'Private by default', placementHint: 'caption below grid image 1' },
          { type: 'add-body-text', id: 'caption-2', text: 'Fast local inference', placementHint: 'caption below grid image 2' },
          { type: 'add-body-text', id: 'caption-3', text: 'No backend required', placementHint: 'caption below grid image 3' },
        ],
      },
      'Three-image grid about Web AI, with matching captions.',
    );

    expect(normalized.tasks.filter((task) => task.type === 'add-shape')).toHaveLength(0);
    expect(normalized.tasks.filter((task) => task.type === 'add-placeholder-image')).toEqual([
      { type: 'add-placeholder-image', id: 'card-1', description: 'Private by default', placementHint: 'grid image 1 left' },
      { type: 'add-placeholder-image', id: 'card-2', description: 'Fast local inference', placementHint: 'grid image 2 center' },
      { type: 'add-placeholder-image', id: 'card-3', description: 'No backend required', placementHint: 'grid image 3 right' },
    ]);
  });

  it('adds placeholder image tasks for image grid prompts even when the model only returns text', () => {
    const normalized = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        language: 'en',
        page,
        tasks: [
          { type: 'set-background', color: '#050D10' },
          { type: 'add-title', id: 'title', text: 'Web AI', placementHint: 'top title band' },
          { type: 'add-body-text', id: 'caption-1', text: 'Privacy', placementHint: 'caption below grid image 1' },
          { type: 'add-body-text', id: 'caption-2', text: 'Speed', placementHint: 'caption below grid image 2' },
          { type: 'add-body-text', id: 'caption-3', text: 'No Backend', placementHint: 'caption below grid image 3' },
        ],
      },
      'Three image grid about Web AI, with matching captions.',
    );

    expect(normalized.tasks.filter((task) => task.type === 'add-placeholder-image')).toEqual([
      { type: 'add-placeholder-image', id: 'grid-image-1', description: 'Privacy', placementHint: 'grid image 1 left' },
      { type: 'add-placeholder-image', id: 'grid-image-2', description: 'Speed', placementHint: 'grid image 2 center' },
      { type: 'add-placeholder-image', id: 'grid-image-3', description: 'No Backend', placementHint: 'grid image 3 right' },
    ]);
  });

  it('pins two-image grids into equal-width columns', () => {
    const leftImage = slideLayoutPresets.applySlideElementLayoutPreset(
      { type: 'image', id: 'two-grid-1', assetRole: 'placeholder', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      {
        task: twoImageGridTasks[2] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
        allTasks: twoImageGridTasks,
        page,
      },
    );
    const rightCaption = slideLayoutPresets.applySlideElementLayoutPreset(textElement('two-caption-2', 'Keeps teams connected'), {
      task: twoImageGridTasks[5] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: twoImageGridTasks,
      page,
    });

    expect(leftImage).toMatchObject({ x: 180, y: 300, width: 700, height: 390 });
    expect(rightCaption).toMatchObject({
      x: 1040,
      y: 720,
      width: 700,
      height: 110,
      fontFamily: 'Open Sans',
      fontSize: 36,
      fill: '#FFFFFF',
      align: 'center',
    });
  });

  it('centers title-only slides as a presentation hero title', () => {
    const titleOnlyTasks: GeneratedSlideTask[] = [
      { type: 'set-background', color: '#050D10' },
      { type: 'add-title', id: 'title-only', text: 'Web AI Runs Here', placementHint: 'best fit' },
    ];

    const title = slideLayoutPresets.applySlideElementLayoutPreset(textElement('title-only', 'Web AI Runs Here'), {
      task: titleOnlyTasks[1] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: titleOnlyTasks,
      page,
    });

    expect(title).toMatchObject({
      x: 250,
      y: 410,
      width: 1420,
      height: 220,
      fontFamily: 'Orbitron',
      fontSize: 112,
      fontWeight: 800,
      fill: '#37FD76',
      align: 'center',
    });
  });

  it('normalizes bullet prompts into a title and one bullet-list task', () => {
    const normalized = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        language: 'en',
        page,
        tasks: [
          { type: 'set-background', color: '#050D10' },
          { type: 'add-title', id: 'title', text: 'Why Web AI', placementHint: 'best fit' },
          { type: 'add-body-text', id: 'body-1', text: 'Automation of tasks', placementHint: 'best fit' },
          { type: 'add-body-text', id: 'body-2', text: 'Private by default', placementHint: 'best fit' },
        ],
      },
      'Top title and three body bullets about why Web AI is useful.',
    );

    expect(normalized.tasks).toEqual([
      { type: 'set-background', color: '#050D10' },
      { type: 'add-title', id: 'title', text: 'Why Web AI', placementHint: 'top title band' },
      {
        type: 'add-bullets',
        id: 'generated-bullets',
        items: ['Automation of tasks', 'Private by default', 'Runs locally in the browser'],
        placementHint: 'body content area',
      },
    ]);
  });

  it('preserves explicit title and bullet text while compiling a left-image bullet layout', () => {
    const normalized = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        language: 'en',
        page,
        tasks: [
          { type: 'set-background', color: '#050D10' },
          { type: 'add-placeholder-image', id: 'image', description: 'Placeholder image', placementHint: 'best fit' },
          { type: 'add-title', id: 'title', text: 'Wrong Title', placementHint: 'best fit' },
          { type: 'add-body-text', id: 'body', text: 'Noise', placementHint: 'best fit' },
        ],
      },
      'a title with text "Web Search" 3 bullet points with "- My idea, - His idea, - Our idea" and a placeholder image in the left',
    );

    expect(normalized.tasks).toEqual([
      { type: 'set-background', color: '#050D10' },
      { type: 'add-placeholder-image', id: 'image', description: 'Placeholder image', placementHint: 'left media block' },
      { type: 'add-title', id: 'title', text: 'Web Search', placementHint: 'right text block title' },
      {
        type: 'add-bullets',
        id: 'generated-bullets',
        items: ['My idea', 'His idea', 'Our idea'],
        placementHint: 'right text block bullets',
      },
    ]);
  });

  it('pins bullet-only slides into readable title and body regions', () => {
    const title = slideLayoutPresets.applySlideElementLayoutPreset(textElement('bullet-title', 'Why Web AI'), {
      task: bulletTasks[1] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: bulletTasks,
      page,
    });
    const bullets = slideLayoutPresets.applySlideElementLayoutPreset(textElement('bullets', '- Private by default\n- Fast local inference\n- No backend required'), {
      task: bulletTasks[2] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: bulletTasks,
      page,
    });

    expect(title).toMatchObject({
      x: 180,
      y: 125,
      width: 1560,
      height: 150,
      fontFamily: 'Orbitron',
      fontSize: 92,
      fill: '#37FD76',
      align: 'center',
    });
    expect(bullets).toMatchObject({
      x: 360,
      y: 360,
      width: 1200,
      height: 430,
      fontFamily: 'Open Sans',
      fontSize: 44,
      fill: '#FFFFFF',
      align: 'left',
    });
  });

  it('pins left-image bullet slides into media and right-content regions', () => {
    const image = slideLayoutPresets.applySlideElementLayoutPreset(
      { type: 'image', id: 'left-image', assetRole: 'placeholder', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      {
        task: leftImageBulletTasks[1] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
        allTasks: leftImageBulletTasks,
        page,
      },
    );
    const bullets = slideLayoutPresets.applySlideElementLayoutPreset(textElement('mixed-bullets', '- My idea\n- His idea\n- Our idea'), {
      task: leftImageBulletTasks[3] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: leftImageBulletTasks,
      page,
    });

    expect(image).toMatchObject({ x: 80, y: 230, width: 840, height: 620 });
    expect(bullets).toMatchObject({
      x: 1100,
      y: 500,
      width: 660,
      height: 300,
      fontFamily: 'Open Sans',
      fontSize: 40,
      fill: '#FFFFFF',
      align: 'left',
    });
  });

  it('normalizes explicit title subtitle color prompts into a centered layout and page background', () => {
    const normalized = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        language: 'en',
        page,
        tasks: [
          { type: 'set-background', color: '#000000' },
          { type: 'add-title', id: 'title', text: 'Web AI Advantage', placementHint: 'best fit' },
          { type: 'add-subtitle', id: 'subtitle', text: 'Fast local intelligence', placementHint: 'best fit' },
        ],
      },
      'Slide with a deep purple background, gold title "Web AI Advantage", and white subtitle "Fast local intelligence"',
    );

    expect(normalized.page.background).toEqual({ type: 'color', color: '#2B0A4A' });
    expect(normalized.tasks).toEqual([
      { type: 'set-background', color: '#2B0A4A' },
      { type: 'add-title', id: 'title', text: 'Web AI Advantage', placementHint: 'center title color #D4AF37' },
      { type: 'add-subtitle', id: 'subtitle', text: 'Fast local intelligence', placementHint: 'center subtitle color #FFFFFF' },
    ]);
  });

  it('pins centered title subtitle slides with requested colors', () => {
    const title = slideLayoutPresets.applySlideElementLayoutPreset(textElement('color-title', 'Web AI Advantage'), {
      task: titleSubtitleTasks[1] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: titleSubtitleTasks,
      page: { ...page, background: { type: 'color', color: '#2B0A4A' } },
    });
    const subtitle = slideLayoutPresets.applySlideElementLayoutPreset(textElement('color-subtitle', 'Fast local intelligence'), {
      task: titleSubtitleTasks[2] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: titleSubtitleTasks,
      page: { ...page, background: { type: 'color', color: '#2B0A4A' } },
    });

    expect(title).toMatchObject({
      x: 240,
      y: 365,
      width: 1440,
      height: 150,
      fontFamily: 'Orbitron',
      fontSize: 98,
      fontWeight: 800,
      fill: '#D4AF37',
      align: 'center',
    });
    expect(subtitle).toMatchObject({
      x: 420,
      y: 540,
      width: 1080,
      height: 80,
      fontFamily: 'Open Sans',
      fontSize: 44,
      fontWeight: 600,
      fill: '#FFFFFF',
      align: 'center',
    });
  });
});
