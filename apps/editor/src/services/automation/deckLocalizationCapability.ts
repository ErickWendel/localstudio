import type {
  DesignElement,
  Page,
  ProjectDocument,
  SemanticSlideDescription,
} from '../../domain/documents/model';
import type { TranslatorService } from '../contracts/interfaces';

export interface DeckCapabilityProgress {
  stage?: string;
  progress?: number;
  current?: number;
  total?: number;
  detail?: string;
  warnings?: string[];
}

export interface DeckCapabilityProgressReporter {
  (progress: DeckCapabilityProgress): void;
}

export interface SlideDescriptionScene {
  slideId: string;
  slideNumber: number;
  name: string;
  width: number;
  height: number;
  background: string;
  elements: SlideDescriptionElementFact[];
  omittedElementCount: number;
}

export interface SlideDescriptionElementFact {
  elementId: string;
  type: DesignElement['type'];
  frame: { x: number; y: number; width: number; height: number };
  opacity: number;
  rotation: number;
  fact: string;
}

export interface LocalSlideDescriptionGenerator {
  id: string;
  generate(input: {
    language: string;
    instruction: string;
    scene: SlideDescriptionScene;
  }): Promise<string>;
}

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

export interface DeckDescriptionFailure {
  slideId: string;
  slideNumber: number;
  message: string;
}

export interface DeckDescriptionResult {
  language: string;
  generatedSlides: number[];
  generatedSlideCount: number;
  skippedSlides: number[];
  skippedSlideCount: number;
  descriptions: Array<{
    slideId: string;
    slideNumber: number;
    generator: string;
    language: string;
    sourceRevision: string;
    freshness: 'fresh';
  }>;
  failures: DeckDescriptionFailure[];
  failureCount: number;
  warnings: string[];
  warningCount: number;
}

interface DeckLocalizationCapabilityOptions {
  translatorService: TranslatorService;
  getProject(): ProjectDocument;
  applyProject(project: ProjectDocument, activePageId?: string): void;
  getProjectRevision(project: ProjectDocument): string;
  getSlideRevision(project: ProjectDocument, pageId: string): string;
  descriptionGenerator?: LocalSlideDescriptionGenerator | undefined;
  now?: (() => string) | undefined;
}

interface DeckLocalizationCapability {
  translateDeckAndNotes(
    input: { targetLanguage: string; sourceLanguage?: string | undefined },
    report: DeckCapabilityProgressReporter,
  ): Promise<DeckTranslationResult>;
  generateDeckDetailedDescription(
    input: {
      slideNumbers?: number[] | undefined;
      language?: string | undefined;
      force?: boolean | undefined;
    },
    report: DeckCapabilityProgressReporter,
  ): Promise<DeckDescriptionResult>;
}

const capabilityLimits = {
  maxDescriptionCharacters: 12_000,
  maxFailureEntries: 100,
  maxSceneElements: 100,
  maxSceneTextCharacters: 2_000,
  maxWarningEntries: 100,
} as const;

function describeError(error: unknown) {
  return error instanceof Error ? error.message : 'The local AI operation failed.';
}

function normalizedLanguage(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function getTranslationSample(project: ProjectDocument) {
  const samples: string[] = [];
  for (const page of project.pages) {
    for (const elementId of page.elementIds) {
      const element = project.elements[elementId];
      if (element?.type === 'text' && element.visible !== false && element.text.trim()) {
        samples.push(element.text.trim());
      }
    }
    if (page.speakerNotes?.trim()) samples.push(page.speakerNotes.trim());
    if (page.semanticDescription?.text.trim()) samples.push(page.semanticDescription.text.trim());
    if (samples.join('\n').length >= 4_000) break;
  }
  return samples.join('\n').slice(0, 4_000);
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

function boundedPush<T>(values: T[], value: T, limit: number) {
  if (values.length < limit) values.push(value);
}

function getElementFact(project: ProjectDocument, element: DesignElement) {
  if (element.type === 'text')
    return `Text reads ${JSON.stringify(element.text.slice(0, capabilityLimits.maxSceneTextCharacters))}.`;
  if (element.type === 'shape') {
    return `Shape is ${element.shape}; fill ${element.fill ?? 'none'}; stroke ${element.stroke ?? 'none'}.`;
  }
  const asset = project.assets[element.assetId];
  const assetName = asset?.name ?? element.assetId;
  if (element.type === 'video') {
    return `Video asset ${JSON.stringify(assetName)}; muted ${element.muted}; loop ${element.loop}.`;
  }
  if (element.type === 'gif') {
    return `GIF asset ${JSON.stringify(assetName)}.`;
  }
  return `Image asset ${JSON.stringify(assetName)}.`;
}

function createScene(
  project: ProjectDocument,
  page: Page,
  slideNumber: number,
): SlideDescriptionScene {
  const visibleElements = page.elementIds
    .map((elementId) => project.elements[elementId])
    .filter((element): element is DesignElement => Boolean(element && element.visible !== false));
  const elements = visibleElements.slice(0, capabilityLimits.maxSceneElements).map((element) => ({
    elementId: element.id,
    type: element.type,
    frame: { x: element.x, y: element.y, width: element.width, height: element.height },
    opacity: element.opacity,
    rotation: element.rotation,
    fact: getElementFact(project, element),
  }));
  const background =
    page.background.type === 'color'
      ? `solid color ${page.background.color}`
      : `asset ${JSON.stringify(project.assets[page.background.assetId]?.name ?? page.background.assetId)} with fallback ${page.background.colorFallback}`;
  return {
    slideId: page.id,
    slideNumber,
    name: page.name,
    width: page.width,
    height: page.height,
    background,
    elements,
    omittedElementCount: visibleElements.length - elements.length,
  };
}

function deterministicDescription(scene: SlideDescriptionScene) {
  const header = `Slide ${scene.slideNumber}, ${JSON.stringify(scene.name)}, is ${scene.width} by ${scene.height} with ${scene.background}.`;
  const elementFacts = scene.elements.map((element) => {
    const frame = `at x ${element.frame.x}, y ${element.frame.y}, width ${element.frame.width}, height ${element.frame.height}`;
    return `${element.type} ${JSON.stringify(element.elementId)} ${frame}, rotation ${element.rotation}, opacity ${element.opacity}. ${element.fact}`;
  });
  if (scene.omittedElementCount > 0) {
    elementFacts.push(
      `${scene.omittedElementCount} additional visible elements are omitted from this bounded description.`,
    );
  }
  return [
    header,
    `It contains ${scene.elements.length + scene.omittedElementCount} visible elements.`,
    ...elementFacts,
  ]
    .join(' ')
    .slice(0, capabilityLimits.maxDescriptionCharacters);
}

function selectSlides(project: ProjectDocument, slideNumbers: number[] | undefined) {
  if (!slideNumbers?.length) {
    return project.pages.map((page, index) => ({ page, slideNumber: index + 1 }));
  }
  const uniqueNumbers = [...new Set(slideNumbers)];
  return uniqueNumbers.map((slideNumber) => ({
    page: project.pages[slideNumber - 1],
    slideNumber,
  }));
}

function createCapability(options: DeckLocalizationCapabilityOptions): DeckLocalizationCapability {
  const now = options.now ?? (() => new Date().toISOString());

  async function translateDeckAndNotes(
    input: { targetLanguage: string; sourceLanguage?: string | undefined },
    report: DeckCapabilityProgressReporter,
  ): Promise<DeckTranslationResult> {
    const project = options.getProject();
    const projectRevision = options.getProjectRevision(project);
    const targetLanguage = normalizedLanguage(input.targetLanguage, 'en');
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
            boundedPush(
              overflowWarnings,
              {
                slideId: page.id,
                slideNumber,
                elementId,
                message: `Translated text may overflow the unchanged frame for ${elementId}.`,
              },
              capabilityLimits.maxWarningEntries,
            );
          }
          if (translated !== element.text) {
            nextElements[elementId] = { ...element, text: translated };
            slideChanged = true;
          }
          translatedTextElements += 1;
        } catch (error) {
          failureCount += 1;
          visualTranslationFailed = true;
          boundedPush(
            failures,
            {
              slideId: page.id,
              slideNumber,
              target: 'text',
              elementId,
              message: describeError(error),
            },
            capabilityLimits.maxFailureEntries,
          );
        }
      }

      if (page.speakerNotes?.trim()) {
        try {
          const translated = await options.translatorService.translate(
            page.speakerNotes,
            targetLanguage,
            {
              sourceLanguage: detectedLanguage,
            },
          );
          if (translated.trim() !== page.speakerNotes) {
            nextPage = { ...nextPage, speakerNotes: translated.trim() };
            slideChanged = true;
          }
          translatedNotes += 1;
        } catch (error) {
          failureCount += 1;
          visualTranslationFailed = true;
          boundedPush(
            failures,
            {
              slideId: page.id,
              slideNumber,
              target: 'speaker-notes',
              message: describeError(error),
            },
            capabilityLimits.maxFailureEntries,
          );
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
          boundedPush(
            failures,
            {
              slideId: page.id,
              slideNumber,
              target: 'semantic-description',
              message: describeError(error),
            },
            capabilityLimits.maxFailureEntries,
          );
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
        boundedPush(changedSlides, slideNumber, capabilityLimits.maxWarningEntries);
      } else {
        skippedSlideCount += 1;
        boundedPush(skippedSlides, slideNumber, capabilityLimits.maxWarningEntries);
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
        pages: nextProject.pages.map((page, index) => {
          const description = page.semanticDescription;
          if (!description || nextPages[index] === project.pages[index]) return page;
          const sourceRevision = options.getSlideRevision(nextProject, page.id);
          return {
            ...page,
            semanticDescription: {
              ...description,
              sourceRevision,
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

  async function generateDeckDetailedDescription(
    input: { slideNumbers?: number[]; language?: string; force?: boolean },
    report: DeckCapabilityProgressReporter,
  ): Promise<DeckDescriptionResult> {
    const project = options.getProject();
    const projectRevision = options.getProjectRevision(project);
    const language = normalizedLanguage(input.language, 'en');
    const selected = selectSlides(project, input.slideNumbers);
    const nextPages = [...project.pages];
    const generatedSlides: number[] = [];
    const skippedSlides: number[] = [];
    const descriptions: DeckDescriptionResult['descriptions'] = [];
    const failures: DeckDescriptionFailure[] = [];
    const warnings: string[] = [];
    let failureCount = 0;
    let warningCount = 0;
    let generatedSlideCount = 0;
    let skippedSlideCount = 0;
    let firstGeneratedSlideNumber: number | undefined;

    for (let index = 0; index < selected.length; index += 1) {
      const { page, slideNumber } = selected[index]!;
      if (!page) {
        failureCount += 1;
        boundedPush(
          failures,
          { slideId: '', slideNumber, message: `Slide ${slideNumber} does not exist.` },
          capabilityLimits.maxFailureEntries,
        );
        continue;
      }
      const sourceRevision = options.getSlideRevision(project, page.id);
      const current = page.semanticDescription;
      const fresh = Boolean(current && !current.stale && current.sourceRevision === sourceRevision);
      if (!input.force && fresh && current?.language === language) {
        skippedSlideCount += 1;
        boundedPush(skippedSlides, slideNumber, capabilityLimits.maxWarningEntries);
        report({
          stage: 'describing-slides',
          progress: selected.length ? Math.round(((index + 1) / selected.length) * 95) : 95,
          current: index + 1,
          total: selected.length,
          detail: `Skipped fresh description for ${page.name}`,
        });
        continue;
      }

      const scene = createScene(project, page, slideNumber);
      let text: string;
      let descriptionLanguage = language;
      let generator = 'deterministic-scene-graph-v1';
      if (options.descriptionGenerator) {
        try {
          text = (
            await options.descriptionGenerator.generate({
              language,
              instruction:
                'Describe only facts explicitly present in the provided scene graph. Do not infer identities, intent, emotion, off-canvas content, or image details that are not provided.',
              scene,
            })
          ).trim();
          if (!text) throw new Error('The local model returned an empty description.');
          text = text.slice(0, capabilityLimits.maxDescriptionCharacters);
          generator = options.descriptionGenerator.id;
        } catch (error) {
          failureCount += 1;
          const message = `Local description generation failed for slide ${slideNumber}: ${describeError(error)} Deterministic scene-graph fallback was used.`;
          boundedPush(
            failures,
            { slideId: page.id, slideNumber, message: describeError(error) },
            capabilityLimits.maxFailureEntries,
          );
          warningCount += 1;
          boundedPush(warnings, message, capabilityLimits.maxWarningEntries);
          text = deterministicDescription(scene);
          descriptionLanguage = 'en';
        }
      } else {
        text = deterministicDescription(scene);
        descriptionLanguage = 'en';
      }

      const description: SemanticSlideDescription = {
        text,
        language: descriptionLanguage,
        generator,
        generatedAt: now(),
        sourceRevision,
        reviewed: false,
        stale: false,
      };
      const pageIndex = project.pages.findIndex((candidate) => candidate.id === page.id);
      nextPages[pageIndex] = { ...page, semanticDescription: description };
      generatedSlideCount += 1;
      firstGeneratedSlideNumber ??= slideNumber;
      boundedPush(generatedSlides, slideNumber, capabilityLimits.maxWarningEntries);
      boundedPush(
        descriptions,
        {
          slideId: page.id,
          slideNumber,
          generator,
          language: descriptionLanguage,
          sourceRevision,
          freshness: 'fresh',
        },
        capabilityLimits.maxWarningEntries,
      );
      report({
        stage: 'describing-slides',
        progress: selected.length ? Math.round(((index + 1) / selected.length) * 95) : 95,
        current: index + 1,
        total: selected.length,
        detail: page.name,
        warnings,
      });
    }

    if (generatedSlideCount > 0) {
      if (options.getProjectRevision(options.getProject()) !== projectRevision) {
        throw new Error(
          'The presentation changed during description generation. Read the current state and retry.',
        );
      }
      const nextProject = { ...project, pages: nextPages, updatedAt: now() };
      options.applyProject(
        nextProject,
        firstGeneratedSlideNumber
          ? nextProject.pages[firstGeneratedSlideNumber - 1]?.id
          : undefined,
      );
    }

    return {
      language,
      generatedSlides,
      generatedSlideCount,
      skippedSlides,
      skippedSlideCount,
      descriptions,
      failures,
      failureCount,
      warnings,
      warningCount,
    };
  }

  return { translateDeckAndNotes, generateDeckDetailedDescription };
}

export const deckLocalizationCapability = { create: createCapability };
