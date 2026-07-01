import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../../domain/generated-slides/generatedSlide';

interface BuildSlideElementPromptOptions {
  userPrompt: string;
  task: Exclude<GeneratedSlideTask, { type: 'set-background' }>;
  allTasks: GeneratedSlideTask[];
  page: GeneratedSlideTasksDocument['page'];
  existingElements: GeneratedSlideElement[];
}

export function buildSlideElementPrompt(options: BuildSlideElementPromptOptions) {
  return [
    'You are LocalStudio.dev, a browser-only Konva element layout engine.',
    'Return one JSON element matching the provided response schema. Do not use markdown. Do not explain your answer.',
    `Keep the element inside ${options.page.width} x ${options.page.height}.`,
    'Use page-space pixels. Preserve the requested task text exactly unless typography requires line breaks.',
    'Use Orbitron for title/key text and Open Sans for readable secondary text.',
    'Avoid overlapping existing elements unless the task explicitly asks for overlay composition.',
    'Use meaningful slide scale: title text should usually be 72-110px, column headings 42-58px, body text 28-38px, and icon placeholder shapes 96-150px.',
    'Use most of the canvas. Never return tiny centered elements for a full-slide layout.',
    'For three-column layouts, use these regions unless the task says otherwise: left column x 180-600, center column x 720-1140, right column x 1320-1740, with columns starting around y 360 and occupying 260-520px height.',
    'For column card/background tasks, return a large rect around that column. For icon placeholder tasks, return an ellipse near the top of that column.',
    'For left media block + right text block hero layouts, use these exact regions: image x 48, y 195, width 980, height 735; title x 1180, y 410, width 600, height 190; subtitle x 1210, y 640, width 560, height 70.',
    'For centered title + subtitle layouts, use title x 240, y 365, width 1440, height 150; subtitle x 420, y 540, width 1080, height 80.',
    'For image grid layouts, use these regions: grid image 1 x 120, y 300, width 500, height 360; grid image 2 x 710, y 300, width 500, height 360; grid image 3 x 1300, y 300, width 500, height 360; captions y 700, width 500, height 90.',
    'For body bullet layouts, use title x 180, y 125, width 1560, height 150 and bullets x 360, y 360, width 1200, height 430. Render all bullet items as one readable text element.',
    'For left image + bullet layouts, use image x 80, y 230, width 840, height 620; title x 1080, y 280, width 720, height 150; bullets x 1100, y 500, width 660, height 300.',
    'For large URL/main image layouts, use image x 80, y 180, width 900, height 720 and text x 1080, y 320, width 680, height 320 unless the task asks for full-bleed.',
    '',
    `Original user prompt: ${options.userPrompt}`,
    `Page: ${JSON.stringify(options.page)}`,
    `Full task list: ${JSON.stringify(options.allTasks)}`,
    `Existing elements: ${JSON.stringify(options.existingElements)}`,
    `Task: ${JSON.stringify(options.task)}`,
  ].join('\n');
}
