interface BuildSlideTaskPromptOptions {
  userPrompt: string;
  targetLanguageHint: string;
  imageUrls: string[];
}

const IMAGE_URL_PATTERN = /https:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>]*)?/gi;

const IMAGE_GENERATION_PATTERNS = [
  /\bgenerate an image\b/i,
  /\bcreate an image\b/i,
  /\bmake an image\b/i,
  /\bimage of\b/i,
  /\bphoto realistic\b/i,
  /\bcrie uma imagem\b/i,
  /\bgerar uma imagem\b/i,
  /\bcrear una imagen\b/i,
  /\bgenera una imagen\b/i,
];

export function extractImageUrls(prompt: string) {
  return Array.from(new Set(prompt.match(IMAGE_URL_PATTERN) ?? []));
}

export function looksLikeImageGenerationRequest(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return false;
  if (extractImageUrls(normalized).length > 0) return false;
  if (/\bplaceholder image\b/i.test(normalized)) return false;
  if (/\bimagem placeholder\b/i.test(normalized)) return false;
  return IMAGE_GENERATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildSlideTaskPrompt(options: BuildSlideTaskPromptOptions) {
  return [
    'You are LocalStudio.ai, a browser-only slide planning engine.',
    'Return JSON that matches the provided response schema. Do not use markdown. Do not explain your answer.',
    'Create a small ordered task list so the editor can render the slide progressively.',
    'Generate all visible text in the language requested by the user. If the user does not specify a language, use the same language as the user prompt.',
    `Target language hint: ${options.targetLanguageHint}.`,
    '',
    'Allowed task types:',
    '- set-background',
    '- add-placeholder-image',
    '- add-remote-image',
    '- add-title',
    '- add-subtitle',
    '- add-body-text',
    '- add-bullets',
    '- add-shape',
    '- add-cta',
    '',
    'Canvas:',
    '- width: 1920',
    '- height: 1080',
    '- coordinates are decided later by the element prompt',
    '- if the user gives no position, choose a polished EW Academy / LocalStudio.ai layout',
    '- every slide must use meaningful canvas area; do not create tiny centered text clusters',
    '- prefer clear layout regions such as title band, left media block, right text block, or equal-width column grid',
    '',
    'Visual system:',
    '- dark background: #050D10 or #000000',
    '- primary green: #37FD76',
    '- white text: #FFFFFF',
    '- muted text: #91999D',
    '- use Orbitron for titles and key labels',
    '- use Open Sans for readable subtitles, bullets, and body copy',
    '- slide titles should be visually dominant',
    '- body text must be readable from presentation distance',
    '',
    'Layout recipes:',
    '- For "three columns", "3 columns", or three named topics: create one add-title task, then for each column create an add-shape card/background task, one add-shape ellipse icon placeholder task, one add-subtitle heading task, and one add-body-text sentence task. Use placementHint values that explicitly name column 1 left, column 2 center, and column 3 right.',
    '- For "icon placeholder", use add-shape with shape "ellipse" unless the user asks for a real photo or provided image URL.',
    '- For "placeholder image", use add-placeholder-image only when the user asks for a photo/image placeholder, not for small icons.',
    '- For "left image and right title", create the image task before the title/subtitle tasks and set placement hints to left media block and right text block.',
    '- For bullet slides, create a large title task and one add-bullets task with 3-5 concise bullet items.',
    '',
    'Images:',
    '- If the user asks for a placeholder image, create an add-placeholder-image task.',
    '- If the user provides an https image URL, create an add-remote-image task using that exact URL.',
    '- Do not invent image URLs.',
    '- If the user asks to generate a new image, the UI will block before this prompt runs.',
    options.imageUrls.length > 0 ? `Known image URLs: ${options.imageUrls.join(', ')}` : 'Known image URLs: none',
    '',
    `User prompt: ${options.userPrompt}`,
  ].join('\n');
}
