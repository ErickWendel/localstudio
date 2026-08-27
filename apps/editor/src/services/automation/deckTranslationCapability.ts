import type { DesignElement, ProjectDocument } from '../../domain/documents/model';
import type {
  DeckCapabilityProgressReporter,
  DeckLocalizationCapabilityOptions,
} from './deckLocalizationCapability';

export interface DeckTranslationFailure {
  slideId: string;
  slideNumber: number;
  target: 'semantic-description' | 'speaker-notes' | 'text';
  message: string;
  elementId?: string;
}

export interface DeckTranslationOverflowWarning {
  slideId: string;
  slideNumber: number;
  elementId: string;
  message: string;
}

export interface DeckTranslationResult {
  targetLanguage: string;
  detectedLanguage: string;
  changedSlides: number[];
  changedSlideCount: number;
  skippedSlides: number[];
  skippedSlideCount: number;
  translatedTextElements: number;
  translatedNotes: number;
  translatedDescriptions: number;
  overflowWarnings: DeckTranslationOverflowWarning[];
  failures: DeckTranslationFailure[];
  failureCount: number;
  overflowWarningCount: number;
}

const maximumResultEntries = 100;
const maximumTranslationSampleCharacters = 4_000;

function describeError(error: unknown) {
  return error instanceof Error ? error.message : 'The local AI operation failed.';
}

function getTranslationSample(project: ProjectDocument) {
  const samples: string[] = [];
  let remainingCharacters = maximumTranslationSampleCharacters;
  function appendSample(value: string | undefined) {
    if (!value || remainingCharacters <= 0) return;
    const separatorLength = samples.length ? 1 : 0;
    if (remainingCharacters <= separatorLength) {
      remainingCharacters = 0;
      return;
    }
    const sample = value.slice(0, Math.max(0, remainingCharacters - separatorLength)).trim();
    if (!sample) return;
    samples.push(sample);
    remainingCharacters -= sample.length + separatorLength;
  }
  for (const page of project.pages) {
    for (const elementId of page.elementIds) {
      const element = project.elements[elementId];
      if (element?.type === 'text' && element.visible !== false && element.text) {
        appendSample(element.text);
      }
      if (remainingCharacters <= 0) return samples.join('\n');
    }
    appendSample(page.speakerNotes);
    appendSample(page.semanticDescription?.text);
    if (remainingCharacters <= 0) break;
  }
  return samples.join('\n');
}

function normalizeTranslatedText(original: string, translated: string) {
  return original.includes('\n') ? translated.trim() : translated.replace(/\s+/g, ' ').trim();
}

function likelyOverflows(element: Extract<DesignElement, { type: 'text' }>, text: string) {
  const charactersPerLine = Math.max(
    1,
    Math.floor(element.width / Math.max(1, element.fontSize * 0.58)),
  );
  const availableLines = Math.max(
    1,
    Math.floor(element.height / Math.max(1, element.fontSize * 1.08)),
  );
  const requiredLines = text.split('\n').reduce((total, line) => {
    return total + Math.max(1, Math.ceil(Array.from(line).length / charactersPerLine));
  }, 0);
  return requiredLines > availableLines;
}

function boundedPush<T>(values: T[], value: T) {
  if (values.length < maximumResultEntries) values.push(value);
}

function createCapability(options: DeckLocalizationCapabilityOptions) {
  const now = options.now ?? (() => new Date().toISOString());

  async function translateDeckAndNotes(
    input: { targetLanguage: string; sourceLanguage?: string | undefined },
    report: DeckCapabilityProgressReporter,
  ): Promise<DeckTranslationResult> {
    const project = options.getProject();
    const projectRevision = options.getProjectRevision(project);
    const targetLanguage = input.targetLanguage.trim() || 'en';
    const sample = getTranslationSample(project);
    const detectedLanguage = input.sourceLanguage?.trim()
      ? input.sourceLanguage.trim()
      : sample
        ? await options.translatorService.detectLanguage(sample)
        : 'und';
    if (sample && detectedLanguage !== targetLanguage) {
      report({
        stage: 'preparing-translation',
        progress: 2,
        detail: `${detectedLanguage} to ${targetLanguage}`,
      });
      await options.translatorService.prepareTranslation(detectedLanguage, targetLanguage);
    }

    const nextElements = { ...project.elements };
    const nextPages = [...project.pages];
    const changedSlides: number[] = [];
    const skippedSlides: number[] = [];
    const failures: DeckTranslationFailure[] = [];
    const overflowWarnings: DeckTranslationOverflowWarning[] = [];
    let failureCount = 0;
    let overflowWarningCount = 0;
    let translatedTextElements = 0;
    let translatedNotes = 0;
    let translatedDescriptions = 0;
    let changedSlideCount = 0;
    let skippedSlideCount = 0;
    let firstChangedSlideNumber: number | undefined;

    for (let index = 0; index < project.pages.length; index += 1) {
      const page = project.pages[index]!;
      const slideNumber = index + 1;
      let nextPage = page;
      let slideChanged = false;
      let visualTranslationFailed = false;
      for (const elementId of page.elementIds) {
        const element = project.elements[elementId];
        if (element?.type !== 'text' || element.visible === false || !element.text.trim()) continue;
        try {
          const translated = normalizeTranslatedText(
            element.text,
            await options.translatorService.translate(element.text, targetLanguage, {
              sourceLanguage: detectedLanguage,
            }),
          );
          if (likelyOverflows(element, translated)) {
            overflowWarningCount += 1;
            boundedPush(overflowWarnings, {
              slideId: page.id,
              slideNumber,
              elementId,
              message: `Translated text may overflow the unchanged frame for ${elementId}.`,
            });
          }
          if (translated !== element.text) {
            nextElements[elementId] = { ...element, text: translated };
            slideChanged = true;
          }
          translatedTextElements += 1;
        } catch (error) {
          failureCount += 1;
          visualTranslationFailed = true;
          boundedPush(failures, {
            slideId: page.id,
            slideNumber,
            target: 'text',
            elementId,
            message: describeError(error),
          });
        }
      }

      if (page.speakerNotes?.trim()) {
        try {
          const translated = await options.translatorService.translate(
            page.speakerNotes,
            targetLanguage,
            { sourceLanguage: detectedLanguage },
          );
          if (translated.trim() !== page.speakerNotes) {
            nextPage = { ...nextPage, speakerNotes: translated.trim() };
            slideChanged = true;
          }
          translatedNotes += 1;
        } catch (error) {
          failureCount += 1;
          visualTranslationFailed = true;
          boundedPush(failures, {
            slideId: page.id,
            slideNumber,
            target: 'speaker-notes',
            message: describeError(error),
          });
        }
      }

      if (page.semanticDescription?.text.trim()) {
        try {
          const translated = await options.translatorService.translate(
            page.semanticDescription.text,
            targetLanguage,
            { sourceLanguage: detectedLanguage },
          );
          nextPage = {
            ...nextPage,
            semanticDescription: {
              ...page.semanticDescription,
              text: translated.trim(),
              language: targetLanguage,
              generatedAt: now(),
              generator: `translation:${page.semanticDescription.generator}`,
              reviewed: false,
              stale: visualTranslationFailed,
            },
          };
          translatedDescriptions += 1;
          slideChanged = true;
        } catch (error) {
          failureCount += 1;
          boundedPush(failures, {
            slideId: page.id,
            slideNumber,
            target: 'semantic-description',
            message: describeError(error),
          });
          if (slideChanged) {
            nextPage = {
              ...nextPage,
              semanticDescription: { ...page.semanticDescription, stale: true },
            };
          }
        }
      }

      nextPages[index] = nextPage;
      if (slideChanged) {
        changedSlideCount += 1;
        firstChangedSlideNumber ??= slideNumber;
        boundedPush(changedSlides, slideNumber);
      } else {
        skippedSlideCount += 1;
        boundedPush(skippedSlides, slideNumber);
      }
      report({
        stage: 'translating-slides',
        progress: project.pages.length
          ? Math.round(((index + 1) / project.pages.length) * 90) + 5
          : 95,
        current: index + 1,
        total: project.pages.length,
        detail: page.name,
        warnings: overflowWarnings.map((warning) => warning.message),
      });
    }

    if (changedSlideCount > 0) {
      if (options.getProjectRevision(options.getProject()) !== projectRevision) {
        throw new Error(
          'The presentation changed during translation. Read the current state and retry.',
        );
      }
      let nextProject: ProjectDocument = {
        ...project,
        elements: nextElements,
        pages: nextPages,
        updatedAt: now(),
      };
      nextProject = {
        ...nextProject,
        pages: nextProject.pages.map((translatedPage, index) => {
          const description = translatedPage.semanticDescription;
          if (!description || nextPages[index] === project.pages[index]) return translatedPage;
          return {
            ...translatedPage,
            semanticDescription: {
              ...description,
              sourceRevision: options.getSlideRevision(nextProject, translatedPage.id),
              stale: description.stale || false,
            },
          };
        }),
      };
      options.applyProject(
        nextProject,
        firstChangedSlideNumber ? nextProject.pages[firstChangedSlideNumber - 1]?.id : undefined,
      );
    }

    return {
      targetLanguage,
      detectedLanguage,
      changedSlides,
      changedSlideCount,
      skippedSlides,
      skippedSlideCount,
      translatedTextElements,
      translatedNotes,
      translatedDescriptions,
      overflowWarnings,
      failures,
      failureCount,
      overflowWarningCount,
    };
  }

  return { translateDeckAndNotes };
}

export const deckTranslationCapability = { create: createCapability };
