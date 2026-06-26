import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../../../../src/domain/generatedSlide';
import { applySlideElementLayoutPreset } from '../../../../src/services/prompts/slideLayoutPresets';

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

    expect(applySlideElementLayoutPreset(element, { task: tasks[1] as Exclude<GeneratedSlideTask, { type: 'set-background' }>, allTasks: tasks, page })).toMatchObject({
      x: 48,
      y: 195,
      width: 980,
      height: 735,
      rotation: 0,
      opacity: 1,
    });
  });

  it('formats the right-side title and subtitle without changing their text', () => {
    const title = applySlideElementLayoutPreset(textElement('title', 'AI Design Revolution'), {
      task: tasks[2] as Exclude<GeneratedSlideTask, { type: 'set-background' }>,
      allTasks: tasks,
      page,
    });
    const subtitle = applySlideElementLayoutPreset(textElement('subtitle', 'Browser-native creative'), {
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
});
