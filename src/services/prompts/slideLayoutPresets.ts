import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../../domain/generatedSlide';

interface SlideElementPresetContext {
  task: Exclude<GeneratedSlideTask, { type: 'set-background' }>;
  allTasks: GeneratedSlideTask[];
  page: GeneratedSlideTasksDocument['page'];
}

type ImageTask = Extract<GeneratedSlideTask, { type: 'add-placeholder-image' | 'add-remote-image' }>;
type TextTask = Extract<GeneratedSlideTask, { type: 'add-title' | 'add-subtitle' | 'add-body-text' | 'add-cta' }>;
type BulletTask = Extract<GeneratedSlideTask, { type: 'add-bullets' }>;
type ShapeTask = Extract<GeneratedSlideTask, { type: 'add-shape' }>;
type GridColumn = 'left' | 'center' | 'right';
type TwoGridColumn = 'left' | 'right';

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

const GRID_TITLE_FRAME = {
  x: 180,
  y: 120,
  width: 1560,
  height: 120,
  rotation: 0,
  opacity: 1,
} as const;

const GRID_IMAGE_FRAMES = {
  left: { x: 120, y: 300, width: 500, height: 360, rotation: 0, opacity: 1 },
  center: { x: 710, y: 300, width: 500, height: 360, rotation: 0, opacity: 1 },
  right: { x: 1300, y: 300, width: 500, height: 360, rotation: 0, opacity: 1 },
} as const;

const GRID_CAPTION_FRAMES = {
  left: { x: 120, y: 700, width: 500, height: 110, rotation: 0, opacity: 1 },
  center: { x: 710, y: 700, width: 500, height: 110, rotation: 0, opacity: 1 },
  right: { x: 1300, y: 700, width: 500, height: 110, rotation: 0, opacity: 1 },
} as const;

const TWO_GRID_IMAGE_FRAMES = {
  left: { x: 180, y: 300, width: 700, height: 390, rotation: 0, opacity: 1 },
  right: { x: 1040, y: 300, width: 700, height: 390, rotation: 0, opacity: 1 },
} as const;

const TWO_GRID_CAPTION_FRAMES = {
  left: { x: 180, y: 720, width: 700, height: 110, rotation: 0, opacity: 1 },
  right: { x: 1040, y: 720, width: 700, height: 110, rotation: 0, opacity: 1 },
} as const;

const TITLE_ONLY_FRAME = {
  x: 250,
  y: 410,
  width: 1420,
  height: 220,
  rotation: 0,
  opacity: 1,
} as const;

const CENTER_TITLE_FRAME = {
  x: 240,
  y: 365,
  width: 1440,
  height: 150,
  rotation: 0,
  opacity: 1,
} as const;

const CENTER_SUBTITLE_FRAME = {
  x: 420,
  y: 540,
  width: 1080,
  height: 80,
  rotation: 0,
  opacity: 1,
} as const;

const BULLET_TITLE_FRAME = {
  x: 180,
  y: 125,
  width: 1560,
  height: 150,
  rotation: 0,
  opacity: 1,
} as const;

const BULLET_BODY_FRAME = {
  x: 360,
  y: 360,
  width: 1200,
  height: 430,
  rotation: 0,
  opacity: 1,
} as const;

const LEFT_BULLET_MEDIA_FRAME = {
  x: 80,
  y: 230,
  width: 840,
  height: 620,
  rotation: 0,
  opacity: 1,
} as const;

const RIGHT_BULLET_TITLE_FRAME = {
  x: 1080,
  y: 280,
  width: 720,
  height: 150,
  rotation: 0,
  opacity: 1,
} as const;

const RIGHT_BULLET_BODY_FRAME = {
  x: 1100,
  y: 500,
  width: 660,
  height: 300,
  rotation: 0,
  opacity: 1,
} as const;

const DEFAULT_WEB_AI_BULLETS = ['Runs locally in the browser', 'Keeps user data private', 'Removes backend round trips'] as const;
const COLOR_NAME_HEX: Record<string, string> = {
  black: '#000000',
  charcoal: '#111827',
  cyan: '#22D3EE',
  'deep purple': '#2B0A4A',
  emerald: '#10B981',
  gold: '#D4AF37',
  green: '#37FD76',
  magenta: '#FF4FD8',
  navy: '#0B122A',
  orange: '#F97316',
  purple: '#4C1D95',
  white: '#FFFFFF',
};

function includesHint(task: GeneratedSlideTask, ...needles: string[]) {
  if (!('placementHint' in task)) return false;
  const hint = task.placementHint.toLowerCase();
  return needles.every((needle) => hint.includes(needle));
}

function isImageTask(task: GeneratedSlideTask): task is ImageTask {
  return task.type === 'add-placeholder-image' || task.type === 'add-remote-image';
}

function isTextTask(task: GeneratedSlideTask): task is TextTask {
  return task.type === 'add-title' || task.type === 'add-subtitle' || task.type === 'add-body-text' || task.type === 'add-cta';
}

function isBackgroundTask(task: GeneratedSlideTask): task is Extract<GeneratedSlideTask, { type: 'set-background' }> {
  return task.type === 'set-background';
}

function isBulletTask(task: GeneratedSlideTask): task is BulletTask {
  return task.type === 'add-bullets';
}

function isShapeTask(task: GeneratedSlideTask): task is ShapeTask {
  return task.type === 'add-shape';
}

function imageElementFromTask(
  task: ImageTask,
  frame: Pick<GeneratedSlideElement, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity'>,
): GeneratedSlideElement {
  return {
    type: 'image',
    id: task.id,
    assetRole: task.type === 'add-remote-image' ? 'remote' : 'placeholder',
    ...(task.type === 'add-remote-image' ? { src: task.url } : {}),
    ...frame,
  };
}

function usesImageGridPrompt(userPrompt: string) {
  return /\b(?:image grid|three-image grid|two-image grid|3 images|2 images|three images|two images|matching captions)\b/i.test(userPrompt);
}

function usesBulletPrompt(userPrompt: string) {
  return /\b(?:bullets?|bullet points?|body bullets?)\b/i.test(userPrompt);
}

function usesTitleSubtitlePrompt(userPrompt: string) {
  return /\btitle\b/i.test(userPrompt) && /\bsubtitle\b/i.test(userPrompt);
}

function requestsLeftImage(userPrompt: string) {
  return /\b(?:image|placeholder image|photo|media)\b[^.]*\bleft\b/i.test(userPrompt) || /\bleft\b[^.]*\b(?:image|placeholder image|photo|media)\b/i.test(userPrompt);
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

function gridImageTasks(tasks: GeneratedSlideTask[]) {
  return tasks.filter(
    (task) => isImageTask(task) && ('placementHint' in task) && task.placementHint.toLowerCase().includes('grid image'),
  );
}

function gridShapeTasks(tasks: GeneratedSlideTask[]) {
  return tasks.filter(
    (task): task is ShapeTask => isShapeTask(task) && task.placementHint.toLowerCase().includes('grid image'),
  );
}

function usesImageGridLayout(tasks: GeneratedSlideTask[]) {
  return gridImageTasks(tasks).length >= 2;
}

function isTitleOnlyLayout(tasks: GeneratedSlideTask[]) {
  const visibleTasks = tasks.filter((task) => !isBackgroundTask(task));
  return visibleTasks.length === 1 && visibleTasks[0]?.type === 'add-title';
}

function gridColumnFromHint(task: GeneratedSlideTask): GridColumn | undefined {
  if (!('placementHint' in task)) return undefined;
  const hint = task.placementHint.toLowerCase();
  if (hint.includes('1') || hint.includes('left')) return 'left';
  if (hint.includes('2') || hint.includes('center')) return 'center';
  if (hint.includes('3') || hint.includes('right')) return 'right';
  return undefined;
}

function twoGridColumnFromHint(task: GeneratedSlideTask): TwoGridColumn | undefined {
  if (!('placementHint' in task)) return undefined;
  const hint = task.placementHint.toLowerCase();
  if (hint.includes('1') || hint.includes('left')) return 'left';
  if (hint.includes('2') || hint.includes('right')) return 'right';
  return undefined;
}

function isOverviewText(task: TextTask) {
  return /^(?:overview|summary|intro|introduction)\b/i.test(task.text.trim());
}

function textTaskContent(task: TextTask) {
  return task.text.trim();
}

function titleFromPrompt(userPrompt: string) {
  return (
    userPrompt.match(/\btitle\s+(?:with\s+)?(?:text\s*)?["“]([^"”]+)["”]/i)?.[1]?.trim() ??
    userPrompt.match(/\btitle\s*["“]([^"”]+)["”]/i)?.[1]?.trim()
  );
}

function subtitleFromPrompt(userPrompt: string) {
  return (
    userPrompt.match(/\bsubtitle\s+(?:with\s+)?(?:text\s*)?["“]([^"”]+)["”]/i)?.[1]?.trim() ??
    userPrompt.match(/\bsubtitle\s*["“]([^"”]+)["”]/i)?.[1]?.trim()
  );
}

function colorBeforeRole(userPrompt: string, role: 'background' | 'title' | 'subtitle') {
  const colorNames = Object.keys(COLOR_NAME_HEX).sort((left, right) => right.length - left.length);
  const lowerPrompt = userPrompt.toLowerCase();
  for (const colorName of colorNames) {
    const pattern = new RegExp(`\\b${colorName.replace(/\s+/g, '\\s+')}\\s+${role}\\b`, 'i');
    if (pattern.test(lowerPrompt)) return COLOR_NAME_HEX[colorName];
  }
  return undefined;
}

function colorFromHint(task: GeneratedSlideTask) {
  if (!('placementHint' in task)) return undefined;
  return task.placementHint.match(/color\s+(#[0-9a-f]{6})/i)?.[1]?.toUpperCase();
}

function bulletsFromPrompt(userPrompt: string) {
  const items = Array.from(userPrompt.matchAll(/-\s*([^,\n"”]+)/g), (match) => match[1]?.trim() ?? '').filter(Boolean);
  return Array.from(new Set(items));
}

function desiredBulletCount(userPrompt: string) {
  if (/\b(?:three|3)\s+(?:body\s+)?bullets?\b/i.test(userPrompt) || /\b(?:three|3)\s+bullet points?\b/i.test(userPrompt)) return 3;
  if (/\b(?:two|2)\s+(?:body\s+)?bullets?\b/i.test(userPrompt) || /\b(?:two|2)\s+bullet points?\b/i.test(userPrompt)) return 2;
  return undefined;
}

function desiredImageGridCount(userPrompt: string) {
  if (/\b(?:two-image grid|2 images|two images)\b/i.test(userPrompt)) return 2;
  if (/\b(?:three-image grid|3 images|three images|image grid|matching captions)\b/i.test(userPrompt)) return 3;
  return undefined;
}

function completeBulletItems(items: string[], userPrompt: string) {
  const count = desiredBulletCount(userPrompt);
  if (!count || items.length >= count) return items;
  return [...items, ...DEFAULT_WEB_AI_BULLETS.filter((item) => !items.includes(item))].slice(0, count);
}

function gridColumnLabel(index: number, total: number) {
  if (total === 2) return index === 0 ? 'left' : 'right';
  return (['left', 'center', 'right'] as const)[Math.min(index, 2)];
}

function buildGridImageTasks(
  document: GeneratedSlideTasksDocument,
  imageTasks: ImageTask[],
  captionCandidates: TextTask[],
  userPrompt: string,
) {
  const targetCount = Math.max(imageTasks.length, gridShapeTasks(document.tasks).length, desiredImageGridCount(userPrompt) ?? 0);
  if (imageTasks.length >= Math.min(targetCount, 3)) return imageTasks.slice(0, 3);

  const shapes = gridShapeTasks(document.tasks);
  return Array.from({ length: Math.min(Math.max(targetCount, 2), 3) }, (_, index): ImageTask => {
    const existingImage = imageTasks[index];
    if (existingImage) return existingImage;
    const shape = shapes[index];
    const caption = captionCandidates[index]?.text;
    return {
      type: 'add-placeholder-image',
      id: shape?.id ?? `grid-image-${index + 1}`,
      description: caption ?? `Web AI image ${index + 1}`,
      placementHint: shape?.placementHint ?? `grid image ${index + 1} ${gridColumnLabel(index, targetCount)}`,
    };
  });
}

function normalizeImageGridTasks(
  document: GeneratedSlideTasksDocument,
  imageTasks: ImageTask[],
  userPrompt: string,
): GeneratedSlideTasksDocument {
  const title = document.tasks.find((task): task is Extract<GeneratedSlideTask, { type: 'add-title' }> => task.type === 'add-title');
  const backgroundTasks = document.tasks.filter(isBackgroundTask);
  const captionCandidates = document.tasks.filter(
    (task): task is TextTask => isTextTask(task) && task.type !== 'add-title' && !isOverviewText(task),
  );
  const images = buildGridImageTasks(document, imageTasks, captionCandidates, userPrompt);
  const titleTask: GeneratedSlideTask = title
    ? { ...title, placementHint: 'top title band' }
    : {
        type: 'add-title',
        id: 'generated-title',
        text: document.page.name || 'Web AI',
        placementHint: 'top title band',
      };

  const normalizedImages = images.map((task, index): ImageTask => ({
    ...task,
    placementHint: `grid image ${index + 1} ${gridColumnLabel(index, images.length)}`,
  }));

  const captions = images.map((image, index): GeneratedSlideTask => {
    const candidate = captionCandidates[index];
    return {
      type: 'add-body-text',
      id: candidate?.id ?? `${image.id}-caption`,
      text: candidate?.text ?? image.description,
      placementHint: `caption below grid image ${index + 1}`,
    };
  });

  return {
    ...document,
    tasks: [...backgroundTasks, titleTask, ...normalizedImages, ...captions],
  };
}

function normalizeBulletTasks(document: GeneratedSlideTasksDocument, userPrompt: string): GeneratedSlideTasksDocument {
  const backgroundTasks = document.tasks.filter(isBackgroundTask);
  const image = document.tasks.find(isImageTask);
  const title = document.tasks.find((task): task is Extract<GeneratedSlideTask, { type: 'add-title' }> => task.type === 'add-title');
  const existingBullets = document.tasks.find(isBulletTask);
  const textCandidates = document.tasks.filter(
    (task): task is TextTask => isTextTask(task) && task.type !== 'add-title' && !isOverviewText(task),
  );
  const explicitTitle = titleFromPrompt(userPrompt);
  const explicitBullets = bulletsFromPrompt(userPrompt);
  const textItems = textCandidates.map(textTaskContent).filter(Boolean);
  const bulletItems = completeBulletItems(
    explicitBullets.length > 0 ? explicitBullets : existingBullets?.items.length ? existingBullets.items : textItems,
    userPrompt,
  );
  const hasLeftImage = Boolean(image && (requestsLeftImage(userPrompt) || includesHint(image, 'left')));
  const titleTask: GeneratedSlideTask = {
    type: 'add-title',
    id: title?.id ?? 'generated-title',
    text: explicitTitle ?? title?.text ?? document.page.name,
    placementHint: hasLeftImage ? 'right text block title' : 'top title band',
  };
  const bulletTask: GeneratedSlideTask = {
    type: 'add-bullets',
    id: existingBullets?.id ?? 'generated-bullets',
    items: bulletItems.length > 0 ? bulletItems : [...DEFAULT_WEB_AI_BULLETS],
    placementHint: hasLeftImage ? 'right text block bullets' : 'body content area',
  };
  const imageTask = image && hasLeftImage ? [{ ...image, placementHint: 'left media block' }] : [];

  return {
    ...document,
    tasks: [...backgroundTasks, ...imageTask, titleTask, bulletTask],
  };
}

function normalizeTitleSubtitleTasks(document: GeneratedSlideTasksDocument, userPrompt: string): GeneratedSlideTasksDocument {
  const title = document.tasks.find((task): task is Extract<GeneratedSlideTask, { type: 'add-title' }> => task.type === 'add-title');
  const subtitle = document.tasks.find((task): task is Extract<GeneratedSlideTask, { type: 'add-subtitle' }> => task.type === 'add-subtitle');
  const backgroundColor = colorBeforeRole(userPrompt, 'background') ?? document.page.background.color;
  const titleColor = colorBeforeRole(userPrompt, 'title') ?? '#37FD76';
  const subtitleColor = colorBeforeRole(userPrompt, 'subtitle') ?? '#FFFFFF';
  const titleTask: GeneratedSlideTask = {
    type: 'add-title',
    id: title?.id ?? 'generated-title',
    text: titleFromPrompt(userPrompt) ?? title?.text ?? document.page.name,
    placementHint: `center title color ${titleColor}`,
  };
  const subtitleTask: GeneratedSlideTask = {
    type: 'add-subtitle',
    id: subtitle?.id ?? 'generated-subtitle',
    text: subtitleFromPrompt(userPrompt) ?? subtitle?.text ?? '',
    placementHint: `center subtitle color ${subtitleColor}`,
  };

  return {
    ...document,
    page: {
      ...document.page,
      background: { type: 'color', color: backgroundColor },
    },
    tasks: [{ type: 'set-background', color: backgroundColor }, titleTask, subtitleTask],
  };
}

export function normalizeSlideTasksForLayout(
  document: GeneratedSlideTasksDocument,
  userPrompt: string,
): GeneratedSlideTasksDocument {
  const images = document.tasks.filter(isImageTask);
  if ((images.length >= 2 || usesImageGridPrompt(userPrompt)) && (usesImageGridPrompt(userPrompt) || usesImageGridLayout(document.tasks))) {
    return normalizeImageGridTasks(document, images, userPrompt);
  }

  if (usesBulletPrompt(userPrompt) || document.tasks.some(isBulletTask)) {
    return normalizeBulletTasks(document, userPrompt);
  }

  if (images.length === 0 && usesTitleSubtitlePrompt(userPrompt)) {
    return normalizeTitleSubtitleTasks(document, userPrompt);
  }

  if (isTitleOnlyLayout(document.tasks)) {
    return {
      ...document,
      tasks: document.tasks.map((task) =>
        task.type === 'add-title' ? { ...task, placementHint: 'center hero title' } : task,
      ),
    };
  }

  return document;
}

function usesBulletLayout(tasks: GeneratedSlideTask[]) {
  return tasks.some(isBulletTask);
}

function usesLeftImageBulletLayout(tasks: GeneratedSlideTask[]) {
  return usesBulletLayout(tasks) && tasks.some((task) => isImageTask(task) && includesHint(task, 'left', 'media'));
}

function usesCenteredTitleSubtitleLayout(tasks: GeneratedSlideTask[]) {
  return tasks.some((task) => task.type === 'add-title' && includesHint(task, 'center', 'title')) &&
    tasks.some((task) => task.type === 'add-subtitle' && includesHint(task, 'center', 'subtitle'));
}

export function applySlideElementLayoutPreset(
  element: GeneratedSlideElement,
  context: SlideElementPresetContext,
): GeneratedSlideElement {
  if (isTitleOnlyLayout(context.allTasks) && context.task.type === 'add-title' && element.type === 'text') {
    return {
      ...element,
      ...TITLE_ONLY_FRAME,
      fontFamily: 'Orbitron',
      fontSize: 112,
      fontWeight: 800,
      fill: '#37FD76',
      align: 'center',
    };
  }

  if (usesCenteredTitleSubtitleLayout(context.allTasks) && element.type === 'text') {
    if (context.task.type === 'add-title') {
      return {
        ...element,
        ...CENTER_TITLE_FRAME,
        fontFamily: 'Orbitron',
        fontSize: 98,
        fontWeight: 800,
        fill: colorFromHint(context.task) ?? '#37FD76',
        align: 'center',
      };
    }

    if (context.task.type === 'add-subtitle') {
      return {
        ...element,
        ...CENTER_SUBTITLE_FRAME,
        fontFamily: 'Open Sans',
        fontSize: 44,
        fontWeight: 600,
        fill: colorFromHint(context.task) ?? '#FFFFFF',
        align: 'center',
      };
    }
  }

  if (usesBulletLayout(context.allTasks)) {
    const leftImageLayout = usesLeftImageBulletLayout(context.allTasks);

    if (leftImageLayout && element.type === 'image' && isImageTask(context.task) && includesHint(context.task, 'left', 'media')) {
      return {
        ...element,
        ...LEFT_BULLET_MEDIA_FRAME,
      };
    }

    if (element.type === 'text' && context.task.type === 'add-title') {
      return {
        ...element,
        ...(leftImageLayout ? RIGHT_BULLET_TITLE_FRAME : BULLET_TITLE_FRAME),
        fontFamily: 'Orbitron',
        fontSize: leftImageLayout ? 82 : 92,
        fontWeight: 800,
        fill: '#37FD76',
        align: leftImageLayout ? 'left' : 'center',
      };
    }

    if (element.type === 'text' && context.task.type === 'add-bullets') {
      return {
        ...element,
        ...(leftImageLayout ? RIGHT_BULLET_BODY_FRAME : BULLET_BODY_FRAME),
        fontFamily: 'Open Sans',
        fontSize: leftImageLayout ? 40 : 44,
        fontWeight: 600,
        fill: '#FFFFFF',
        align: 'left',
      };
    }
  }

  if (usesImageGridLayout(context.allTasks)) {
    if (context.task.type === 'add-title' && element.type === 'text') {
      return {
        ...element,
        ...GRID_TITLE_FRAME,
        fontFamily: 'Orbitron',
        fontSize: 86,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      };
    }

    const gridImageCount = gridImageTasks(context.allTasks).length;
    const twoColumn = gridImageCount === 2;
    if (twoColumn && isImageTask(context.task)) {
      const column = twoGridColumnFromHint(context.task);
      if (!column) return element;
      const frame = TWO_GRID_IMAGE_FRAMES[column];
      return element.type === 'image' ? { ...element, ...frame } : imageElementFromTask(context.task, frame);
    }
    if (!twoColumn && isImageTask(context.task)) {
      const column = gridColumnFromHint(context.task);
      if (!column) return element;
      const frame = GRID_IMAGE_FRAMES[column];
      return element.type === 'image' ? { ...element, ...frame } : imageElementFromTask(context.task, frame);
    }

    if (twoColumn && element.type === 'text' && (context.task.type === 'add-body-text' || context.task.type === 'add-subtitle')) {
      const column = twoGridColumnFromHint(context.task);
      if (!column) return element;
      return {
        ...element,
        ...TWO_GRID_CAPTION_FRAMES[column],
        fontFamily: 'Open Sans',
        fontSize: 36,
        fontWeight: 600,
        fill: '#FFFFFF',
        align: 'center',
      };
    }

    if (!twoColumn && element.type === 'text' && (context.task.type === 'add-body-text' || context.task.type === 'add-subtitle')) {
      const column = gridColumnFromHint(context.task);
      if (!column) return element;
      return {
        ...element,
        ...GRID_CAPTION_FRAMES[column],
        fontFamily: 'Open Sans',
        fontSize: 34,
        fontWeight: 600,
        fill: '#FFFFFF',
        align: 'center',
      };
    }
  }

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
