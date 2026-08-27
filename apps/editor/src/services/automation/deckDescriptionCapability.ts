import type {
  DesignElement,
  Page,
  ProjectDocument,
  SemanticSlideDescription,
} from '../../domain/documents/model';
import type {
  DeckCapabilityProgressReporter,
  DeckLocalizationCapabilityOptions,
} from './deckLocalizationCapability';

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

const descriptionLimits = {
  maxCharacters: 12_000,
  maxEntries: 100,
  maxSceneElements: 100,
  maxSceneTextCharacters: 2_000,
} as const;

function describeError(error: unknown) {
  return error instanceof Error ? error.message : 'The local AI operation failed.';
}

function boundedPush<T>(values: T[], value: T) {
  if (values.length < descriptionLimits.maxEntries) values.push(value);
}

function getElementFact(project: ProjectDocument, element: DesignElement) {
  if (element.type === 'text')
    return `Text reads ${JSON.stringify(element.text.slice(0, descriptionLimits.maxSceneTextCharacters))}.`;
  if (element.type === 'shape') {
    return `Shape is ${element.shape}; fill ${element.fill ?? 'none'}; stroke ${element.stroke ?? 'none'}.`;
  }
  const asset = project.assets[element.assetId];
  const assetName = asset?.name ?? element.assetId;
  if (element.type === 'video') {
    return `Video asset ${JSON.stringify(assetName)}; muted ${element.muted}; loop ${element.loop}.`;
  }
  if (element.type === 'gif') return `GIF asset ${JSON.stringify(assetName)}.`;
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
  const elements = visibleElements.slice(0, descriptionLimits.maxSceneElements).map((element) => ({
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
    .slice(0, descriptionLimits.maxCharacters);
}

async function translatedDeterministicDescription(
  scene: SlideDescriptionScene,
  language: string,
  options: DeckLocalizationCapabilityOptions,
) {
  const description = deterministicDescription(scene);
  if (language.toLowerCase().startsWith('en')) {
    return { language: 'en', text: description };
  }
  await options.translatorService.prepareTranslation('en', language);
  const translated = (
    await options.translatorService.translate(description, language, { sourceLanguage: 'en' })
  ).trim();
  if (!translated) throw new Error('The local translator returned an empty description.');
  return { language, text: translated.slice(0, descriptionLimits.maxCharacters) };
}

function selectSlides(project: ProjectDocument, slideNumbers: number[] | undefined) {
  if (!slideNumbers?.length) {
    return project.pages.map((page, index) => ({ page, slideNumber: index + 1 }));
  }
  return [...new Set(slideNumbers)].map((slideNumber) => ({
    page: project.pages[slideNumber - 1],
    slideNumber,
  }));
}

function createCapability(options: DeckLocalizationCapabilityOptions) {
  const now = options.now ?? (() => new Date().toISOString());

  async function generateDeckDetailedDescription(
    input: {
      slideNumbers?: number[] | undefined;
      language?: string | undefined;
      force?: boolean | undefined;
    },
    report: DeckCapabilityProgressReporter,
  ): Promise<DeckDescriptionResult> {
    const project = options.getProject();
    const projectRevision = options.getProjectRevision(project);
    const language = input.language?.trim() || 'en';
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
        boundedPush(failures, {
          slideId: '',
          slideNumber,
          message: `Slide ${slideNumber} does not exist.`,
        });
        continue;
      }
      const sourceRevision = options.getSlideRevision(project, page.id);
      const current = page.semanticDescription;
      const fresh = Boolean(current && !current.stale && current.sourceRevision === sourceRevision);
      if (!input.force && fresh && current?.language === language) {
        skippedSlideCount += 1;
        boundedPush(skippedSlides, slideNumber);
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
      const generateDeterministicFallback = async () => {
        try {
          const fallback = await translatedDeterministicDescription(scene, language, options);
          descriptionLanguage = fallback.language;
          return fallback.text;
        } catch (error) {
          const cause = describeError(error);
          warningCount += 1;
          boundedPush(
            warnings,
            `Requested-language fallback failed for slide ${slideNumber}: ${cause} The grounded English description was retained.`,
          );
          descriptionLanguage = 'en';
          return deterministicDescription(scene);
        }
      };
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
          text = text.slice(0, descriptionLimits.maxCharacters);
          generator = options.descriptionGenerator.id;
        } catch (error) {
          failureCount += 1;
          const cause = describeError(error);
          boundedPush(failures, { slideId: page.id, slideNumber, message: cause });
          warningCount += 1;
          boundedPush(
            warnings,
            `Local description generation failed for slide ${slideNumber}: ${cause} Deterministic scene-graph fallback was used.`,
          );
          text = await generateDeterministicFallback();
        }
      } else {
        text = await generateDeterministicFallback();
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
      boundedPush(generatedSlides, slideNumber);
      boundedPush(descriptions, {
        slideId: page.id,
        slideNumber,
        generator,
        language: descriptionLanguage,
        sourceRevision,
        freshness: 'fresh',
      });
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

  return { generateDeckDetailedDescription };
}

export const deckDescriptionCapability = { create: createCapability };
