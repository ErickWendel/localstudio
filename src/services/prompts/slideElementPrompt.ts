import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../../domain/generatedSlide';

interface BuildSlideElementPromptOptions {
  userPrompt: string;
  task: Exclude<GeneratedSlideTask, { type: 'set-background' }>;
  allTasks: GeneratedSlideTask[];
  page: GeneratedSlideTasksDocument['page'];
  existingElements: GeneratedSlideElement[];
}

export function buildSlideElementPrompt(options: BuildSlideElementPromptOptions) {
  return [
    'You are LocalStudio.ai, a browser-only Konva element layout engine.',
    'Return one JSON element matching the provided response schema. Do not use markdown. Do not explain your answer.',
    `Keep the element inside ${options.page.width} x ${options.page.height}.`,
    'Use page-space pixels. Preserve the requested task text exactly unless typography requires line breaks.',
    'Use Orbitron for title/key text and Open Sans for readable secondary text.',
    'Avoid overlapping existing elements unless the task explicitly asks for overlay composition.',
    'Use meaningful slide scale: title text should usually be 72-110px, column headings 42-58px, body text 28-38px, and icon placeholder shapes 96-150px.',
    'Use most of the canvas. Never return tiny centered elements for a full-slide layout.',
    'For three-column layouts, use these regions unless the task says otherwise: left column x 180-600, center column x 720-1140, right column x 1320-1740, with columns starting around y 360 and occupying 260-520px height.',
    'For column card/background tasks, return a large rect around that column. For icon placeholder tasks, return an ellipse near the top of that column.',
    '',
    `Original user prompt: ${options.userPrompt}`,
    `Page: ${JSON.stringify(options.page)}`,
    `Full task list: ${JSON.stringify(options.allTasks)}`,
    `Existing elements: ${JSON.stringify(options.existingElements)}`,
    `Task: ${JSON.stringify(options.task)}`,
  ].join('\n');
}
