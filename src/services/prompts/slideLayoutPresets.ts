import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../../domain/generatedSlide';

interface SlideElementPresetContext {
  task: Exclude<GeneratedSlideTask, { type: 'set-background' }>;
  allTasks: GeneratedSlideTask[];
  page: GeneratedSlideTasksDocument['page'];
}

const LEFT_HERO_MEDIA_FRAME = {
  x: 48,
  y: 195,
  width: 980,
  height: 735,
  rotation: 0,
  opacity: 1,
} as const;

const RIGHT_HERO_TITLE_FRAME = {
  x: 1180,
  y: 410,
  width: 600,
  height: 190,
  rotation: 0,
  opacity: 1,
} as const;

const RIGHT_HERO_SUBTITLE_FRAME = {
  x: 1210,
  y: 640,
  width: 560,
  height: 70,
  rotation: 0,
  opacity: 1,
} as const;

function includesHint(task: GeneratedSlideTask, ...needles: string[]) {
  if (!('placementHint' in task)) return false;
  const hint = task.placementHint.toLowerCase();
  return needles.every((needle) => hint.includes(needle));
}

function usesLeftMediaRightTextLayout(tasks: GeneratedSlideTask[]) {
  const hasLeftImage = tasks.some(
    (task) =>
      (task.type === 'add-placeholder-image' || task.type === 'add-remote-image') &&
      includesHint(task, 'left', 'media block'),
  );
  const hasRightText = tasks.some(
    (task) =>
      (task.type === 'add-title' || task.type === 'add-subtitle' || task.type === 'add-body-text') &&
      includesHint(task, 'right', 'text block'),
  );
  return hasLeftImage && hasRightText;
}

export function applySlideElementLayoutPreset(
  element: GeneratedSlideElement,
  context: SlideElementPresetContext,
): GeneratedSlideElement {
  if (!usesLeftMediaRightTextLayout(context.allTasks)) return element;

  if (
    element.type === 'image' &&
    (context.task.type === 'add-placeholder-image' || context.task.type === 'add-remote-image') &&
    includesHint(context.task, 'left', 'media block')
  ) {
    return {
      ...element,
      ...LEFT_HERO_MEDIA_FRAME,
    };
  }

  if (element.type !== 'text') return element;

  if (context.task.type === 'add-title' && includesHint(context.task, 'right', 'text block')) {
    return {
      ...element,
      ...RIGHT_HERO_TITLE_FRAME,
      fontFamily: 'Orbitron',
      fontSize: 90,
      fontWeight: 800,
      fill: '#37FD76',
      align: 'center',
    };
  }

  if (
    (context.task.type === 'add-subtitle' || context.task.type === 'add-body-text') &&
    includesHint(context.task, 'right', 'text block')
  ) {
    return {
      ...element,
      ...RIGHT_HERO_SUBTITLE_FRAME,
      fontFamily: 'Open Sans',
      fontSize: 40,
      fontWeight: 600,
      fill: '#FFFFFF',
      align: 'center',
    };
  }

  return element;
}
