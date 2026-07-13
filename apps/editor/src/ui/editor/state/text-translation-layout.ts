import type { Page, ProjectDocument, TextElement } from '../../../domain/documents/model';

export type TranslationPatch = {
  fontSize?: number;
  height?: number;
  text: string;
  width?: number;
  x?: number;
};

const TEXT_FRAME_HORIZONTAL_PADDING = 12;
const TEXT_FRAME_VERTICAL_PADDING_RATIO = 0.18;
const TEXT_FRAME_LINE_HEIGHT = 1.08;

function getMinimumTextHeight(text: string, fontSize: number) {
  const lineCount = Math.max(1, text.split('\n').length);
  return getTextHeightForLineCount(lineCount, fontSize);
}

function getTextHeightForLineCount(lineCount: number, fontSize: number) {
  return Math.ceil(
    Math.max(1, lineCount) * fontSize * TEXT_FRAME_LINE_HEIGHT +
      Math.max(12, fontSize * TEXT_FRAME_VERTICAL_PADDING_RATIO),
  );
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

function estimateWrappedLineCount(text: string, fontSize: number, availableWidth: number) {
  const safeAvailableWidth = Math.max(1, availableWidth);
  return text.split('\n').reduce((lineCount, paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return lineCount + 1;

    let currentLineWidth = 0;
    let paragraphLineCount = 1;
    const spaceWidth = estimateSingleLineTextWidth(' ', fontSize);

    for (const word of words) {
      const wordWidth = estimateSingleLineTextWidth(word, fontSize);
      if (currentLineWidth === 0) {
        currentLineWidth = wordWidth;
        paragraphLineCount += Math.max(0, Math.ceil(wordWidth / safeAvailableWidth) - 1);
        continue;
      }

      const nextLineWidth = currentLineWidth + spaceWidth + wordWidth;
      if (nextLineWidth <= safeAvailableWidth) {
        currentLineWidth = nextLineWidth;
        continue;
      }

      paragraphLineCount += 1;
      currentLineWidth = wordWidth;
      paragraphLineCount += Math.max(0, Math.ceil(wordWidth / safeAvailableWidth) - 1);
    }

    return lineCount + paragraphLineCount;
  }, 0);
}

function getMinimumTextFrameHeight(element: TextElement) {
  const availableWidth = element.width - TEXT_FRAME_HORIZONTAL_PADDING;
  const lineCount = estimateWrappedLineCount(element.text, element.fontSize, availableWidth);
  return getTextHeightForLineCount(lineCount, element.fontSize);
}

function fitTranslatedTextToOriginalFrame(
  element: Extract<ProjectDocument['elements'][string], { type: 'text' }>,
  translatedText: string,
  page?: Page,
): TranslationPatch {
  void page;
  const normalizedText = normalizeTranslatedText(element.text, translatedText);
  const availableWidth = Math.max(1, element.width - TEXT_FRAME_HORIZONTAL_PADDING);
  const estimatedLineCount = estimateWrappedLineCount(
    normalizedText,
    element.fontSize,
    availableWidth,
  );
  const nextHeight = getTextHeightForLineCount(estimatedLineCount, element.fontSize);
  if (nextHeight <= element.height) return { text: normalizedText };

  return {
    height: nextHeight,
    text: normalizedText,
  };
}

export const textTranslationLayout = {
  fitTranslatedTextToOriginalFrame,
  getMinimumTextFrameHeight,
  getMinimumTextHeight,
  getPageTextSample,
  mapWithConcurrency,
};
