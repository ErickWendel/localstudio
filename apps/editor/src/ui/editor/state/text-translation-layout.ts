import type { Page, ProjectDocument } from '../../../domain/documents/model';

export type TranslationPatch = {
  fontSize?: number;
  height?: number;
  text: string;
  width?: number;
  x?: number;
};

function getMinimumTextHeight(text: string, fontSize: number) {
  const lineCount = Math.max(1, text.split('\n').length);
  return Math.ceil(lineCount * fontSize * 1.08 + Math.max(12, fontSize * 0.18));
}

function getPageTextSample(project: ProjectDocument, pageId: string) {
  const page = project.pages.find((item) => item.id === pageId);
  if (!page) return '';
  return page.elementIds
    .map((elementId) => project.elements[elementId])
    .filter((element): element is Extract<ProjectDocument['elements'][string], { type: 'text' }> =>
      Boolean(element && element.type === 'text' && element.visible !== false && !element.locked),
    )
    .map((element) => element.text.trim())
    .filter(Boolean)
    .join('\n');
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
      } catch (error) {
        firstError ??= error;
        nextIndex = items.length;
      }
    }
  });

  await Promise.all(workers);
  if (firstError !== undefined) {
    throw firstError instanceof Error ? firstError : new Error('Concurrent task failed.');
  }
  return results;
}

function normalizeTranslatedText(originalText: string, translatedText: string) {
  if (originalText.includes('\n')) return translatedText.trim();
  return translatedText.replace(/\s+/g, ' ').trim();
}

function estimateSingleLineTextWidth(text: string, fontSize: number) {
  return Array.from(text).reduce((width, character) => {
    if (character === ' ') return width + fontSize * 0.32;
    if (/[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÄËÏÖÜÇÑ]/.test(character)) return width + fontSize * 0.68;
    if (/[ilI.,'’|]/.test(character)) return width + fontSize * 0.34;
    return width + fontSize * 0.58;
  }, 0);
}

function fitTranslatedTextToOriginalFrame(
  element: Extract<ProjectDocument['elements'][string], { type: 'text' }>,
  translatedText: string,
  page?: Page,
): TranslationPatch {
  const normalizedText = normalizeTranslatedText(element.text, translatedText);
  if (normalizedText.includes('\n')) return { text: normalizedText };

  const horizontalPadding = 12;
  const availableWidth = Math.max(1, element.width - horizontalPadding);
  const estimatedWidth = estimateSingleLineTextWidth(normalizedText, element.fontSize);
  if (estimatedWidth <= availableWidth) return { text: normalizedText };

  const desiredWidth = Math.ceil(estimatedWidth + horizontalPadding);
  const originalCenter = element.x + element.width / 2;
  const pageWidth =
    page?.width ?? Math.max(element.x + desiredWidth, originalCenter + desiredWidth / 2);
  const maxWidthAroundCenter = Math.max(
    1,
    2 * Math.min(originalCenter, pageWidth - originalCenter),
  );
  const nextWidth = Math.max(element.width, Math.min(desiredWidth, maxWidthAroundCenter));
  const nextX = Math.max(0, Math.min(pageWidth - nextWidth, originalCenter - nextWidth / 2));

  if (nextWidth >= desiredWidth) {
    return {
      text: normalizedText,
      width: nextWidth,
      x: nextX,
    };
  }

  const estimatedLineCount = Math.max(
    1,
    Math.ceil(estimatedWidth / Math.max(1, nextWidth - horizontalPadding)),
  );
  return {
    height: Math.max(element.height, Math.ceil(estimatedLineCount * element.fontSize * 1.08)),
    text: normalizedText,
    width: nextWidth,
    x: nextX,
  };
}

export const textTranslationLayout = {
  fitTranslatedTextToOriginalFrame,
  getMinimumTextHeight,
  getPageTextSample,
  mapWithConcurrency,
};
