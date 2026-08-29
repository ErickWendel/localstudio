import type { Asset, ProjectDocument } from '../../domain/documents/model';
import { sampleProject } from '../../domain/projects/sampleProject';
import type { FontImportService } from '../contracts/interfaces';
import { createPrefixedId } from '../ids/idUtils';
import type { AuthoringAutomationDelegate } from './authoringAutomationController';
import type { AuthoringAssetCapabilities } from './createAuthoringAssetCapabilities';
import type { deckLocalizationCapability } from './deckLocalizationCapability';
import type { createAuthoringVisualCapability } from './authoringVisualCapability';
import type { PowerPointUrlImportService } from './powerPointUrlImportService';
import { authoringRevision } from './getAuthoringSlideRevision';
import {
  slideUpsertService,
  type SlideMediaContentInput,
  type SlideUpsertBatch,
} from './slideUpsertService';

interface CreateAuthoringDelegateOptions {
  assetCapabilities?: AuthoringAssetCapabilities | undefined;
  deckLocalization?: ReturnType<typeof deckLocalizationCapability.create> | undefined;
  fontImportService: FontImportService;
  getProject(): ProjectDocument;
  replaceProject(project: ProjectDocument): void;
  applyProject(project: ProjectDocument, activePageId?: string): void;
  powerPointUrlImportService?: PowerPointUrlImportService | undefined;
  visualCapability?: ReturnType<typeof createAuthoringVisualCapability> | undefined;
}

const builtInFonts = new Set(['arial', 'inter', 'open sans', 'orbitron']);
const maxStateTextLength = 4_000;

function boundedText(value: string | undefined) {
  if (!value || value.length <= maxStateTextLength) return value;
  return `${value.slice(0, maxStateTextLength)}…`;
}

function boundedElement(element: ProjectDocument['elements'][string] | undefined) {
  if (!element) return undefined;
  return element.type === 'text' ? { ...element, text: boundedText(element.text) } : element;
}

function validateRemoteUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Media URLs must be valid absolute URLs.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS media URLs are supported.');
  }
  return url.toString();
}

function createPresentationState(
  project: ProjectDocument,
  input: Parameters<AuthoringAutomationDelegate['getPresentationState']>[0],
) {
  const requestedNumbers = input.slideNumbers?.filter(
    (slideNumber) => Number.isInteger(slideNumber) && slideNumber > 0,
  );
  const cursor = Math.max(0, input.cursor ?? 0);
  const candidates = requestedNumbers?.length
    ? requestedNumbers
        .map((slideNumber) => ({ page: project.pages[slideNumber - 1], slideNumber }))
        .filter((entry): entry is { page: ProjectDocument['pages'][number]; slideNumber: number } =>
          Boolean(entry.page),
        )
    : project.pages
        .map((page, index) => ({ page, slideNumber: index + 1 }))
        .slice(cursor, cursor + 20);
  const detailed = input.detail === 'elements';
  const elementCursor = Math.floor(Math.max(0, input.elementCursor ?? 0));
  const elementLimit = Math.floor(Math.max(1, Math.min(50, input.elementLimit ?? 25)));
  const slides = candidates.slice(0, detailed ? 5 : 20).map(({ page, slideNumber }) => {
    const revision = authoringRevision.getSlide(project, page.id);
    return {
      slideId: page.id,
      slideNumber,
      name: page.name,
      width: page.width,
      height: page.height,
      background: page.background,
      elementCount: page.elementIds.length,
      speakerNotes: boundedText(page.speakerNotes),
      semanticDescription: page.semanticDescription
        ? { ...page.semanticDescription, text: boundedText(page.semanticDescription.text) }
        : undefined,
      descriptionFreshness: page.semanticDescription
        ? page.semanticDescription.stale || page.semanticDescription.sourceRevision !== revision
          ? 'stale'
          : 'fresh'
        : 'missing',
      revision,
      ...(detailed
        ? {
            elements: page.elementIds
              .slice(elementCursor, elementCursor + elementLimit)
              .map((elementId) => boundedElement(project.elements[elementId]))
              .filter(Boolean),
            nextElementCursor:
              elementCursor + elementLimit < page.elementIds.length
                ? elementCursor + elementLimit
                : undefined,
          }
        : {}),
    };
  });
  return {
    projectId: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    revision: authoringRevision.getPresentation(project),
    pageCount: project.pages.length,
    assetCount: Object.keys(project.assets).length,
    recordingCount: Object.keys(project.recordings ?? {}).length,
    slides,
    nextCursor:
      !requestedNumbers?.length && cursor + slides.length < project.pages.length
        ? cursor + slides.length
        : undefined,
  };
}

export function createAuthoringAutomationDelegate(
  options: CreateAuthoringDelegateOptions,
): AuthoringAutomationDelegate {
  const assetCapabilities = options.assetCapabilities;
  const deckLocalization = options.deckLocalization;
  const powerPointUrlImportService = options.powerPointUrlImportService;
  const visualCapability = options.visualCapability;

  function resolveMedia(
    input: SlideMediaContentInput,
    context: { elementId: string; type: 'gif' | 'image' | 'video' },
  ): Promise<Asset> {
    if (input.assetId) {
      const asset = options.getProject().assets[input.assetId];
      if (!asset) throw new Error(`Unknown assetId: ${input.assetId}.`);
      if (asset.type !== context.type && !(context.type === 'image' && asset.type === 'gif')) {
        throw new Error(`Asset ${input.assetId} cannot be used as ${context.type}.`);
      }
      return Promise.resolve(asset);
    }
    if (input.mediaRef) {
      if (!assetCapabilities) {
        throw new Error('Stock media is not configured for this editor.');
      }
      return assetCapabilities.resolveMediaRef(input.mediaRef);
    }
    if (!input.url) throw new Error(`${context.elementId} needs assetId or url.`);
    return Promise.resolve({
      id: `asset-${context.elementId}`,
      type: context.type,
      name: `${context.type} for ${context.elementId}`,
      mimeType:
        context.type === 'video'
          ? 'video/mp4'
          : context.type === 'gif'
            ? 'image/gif'
            : 'image/jpeg',
      objectUrl: validateRemoteUrl(input.url),
      storage: 'remote',
    });
  }

  return {
    createPresentation(input) {
      const width = input.width ?? 1920;
      const height = input.height ?? 1080;
      if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
        throw new Error('Presentation dimensions must be positive finite numbers.');
      }
      const blank = sampleProject.createBlankProject();
      const project = {
        ...blank,
        name: input.name?.trim() || blank.name,
        pages: blank.pages.map((page) => ({ ...page, width, height })),
        updatedAt: new Date().toISOString(),
      };
      options.replaceProject(project);
      return {
        projectId: project.id,
        name: project.name,
        slideId: project.pages[0]?.id,
        width,
        height,
      };
    },

    getPresentationState(input) {
      return createPresentationState(options.getProject(), input);
    },

    ...(powerPointUrlImportService
      ? {
          importPowerPointFromUrl: (
            input: Parameters<
              NonNullable<AuthoringAutomationDelegate['importPowerPointFromUrl']>
            >[0],
            report: Parameters<
              NonNullable<AuthoringAutomationDelegate['importPowerPointFromUrl']>
            >[1],
          ) => powerPointUrlImportService.importPowerPointFromUrl(input, report),
        }
      : {}),

    ...(deckLocalization
      ? {
          translateDeckAndNotes: (
            input: Parameters<NonNullable<AuthoringAutomationDelegate['translateDeckAndNotes']>>[0],
            report: Parameters<
              NonNullable<AuthoringAutomationDelegate['translateDeckAndNotes']>
            >[1],
          ) => deckLocalization.translateDeckAndNotes(input, report),
          generateDeckDetailedDescription: (
            input: Parameters<
              NonNullable<AuthoringAutomationDelegate['generateDeckDetailedDescription']>
            >[0],
            report: Parameters<
              NonNullable<AuthoringAutomationDelegate['generateDeckDetailedDescription']>
            >[1],
          ) => deckLocalization.generateDeckDetailedDescription(input, report),
        }
      : {}),

    ...(assetCapabilities
      ? {
          listAuthoringCatalog: (
            input: Parameters<NonNullable<AuthoringAutomationDelegate['listAuthoringCatalog']>>[0],
          ) => assetCapabilities.listAuthoringCatalog(input),
          generateImage: (
            input: Parameters<NonNullable<AuthoringAutomationDelegate['generateImage']>>[0],
            report: Parameters<NonNullable<AuthoringAutomationDelegate['generateImage']>>[1],
          ) => assetCapabilities.generateImage(input, report),
          getAiModelStatus: () => assetCapabilities.getAiModelStatus(),
          prepareAiModels: (
            input: Parameters<NonNullable<AuthoringAutomationDelegate['prepareAiModels']>>[0],
            report: Parameters<NonNullable<AuthoringAutomationDelegate['prepareAiModels']>>[1],
          ) => assetCapabilities.prepareAiModels(input, report),
          searchMedia: (
            input: Parameters<NonNullable<AuthoringAutomationDelegate['searchMedia']>>[0],
          ) => assetCapabilities.searchMedia(input),
        }
      : {}),

    async upsertSlideContent(batch: SlideUpsertBatch) {
      let project = options.getProject();
      slideUpsertService.validate(project, batch);
      const requestedFonts = [
        ...new Map(
          batch.elements
            .filter((element) => element.type === 'text')
            .map((element) => [
              `${element.style.fontFamily.trim().toLowerCase()}:${element.style.fontWeight}`,
              { family: element.style.fontFamily.trim(), fontWeight: element.style.fontWeight },
            ]),
        ).values(),
      ].filter(({ family }) => family);
      const projectFonts = Object.values(project.fonts ?? {});
      const missingFonts = requestedFonts.filter(
        ({ family, fontWeight }) =>
          !builtInFonts.has(family.toLowerCase()) &&
          !projectFonts.some(
            (font) =>
              font.family.toLowerCase() === family.toLowerCase() && font.fontWeight === fontWeight,
          ),
      );
      if (missingFonts.length) {
        const fontResult = await options.fontImportService.resolveAndDownloadFonts(
          missingFonts.map(({ family, fontWeight }) => ({
            family,
            fontStyle: 'normal',
            fontWeight,
          })),
        );
        const usableStatuses = new Set([
          'available-system',
          'downloaded-exact',
          'downloaded-compatible',
        ]);
        const unresolved = fontResult.resolutions.filter(
          (resolution) => !usableStatuses.has(resolution.status),
        );
        if (unresolved.length) {
          throw new Error(
            `Fonts unavailable: ${unresolved.map((font) => font.requestedFamily).join(', ')}.`,
          );
        }
        project = { ...project, fonts: { ...(project.fonts ?? {}), ...fontResult.fonts } };
        await options.fontImportService.loadProjectFonts(project);
      }
      const result = await slideUpsertService.apply(project, batch, {
        createId: createPrefixedId,
        resolveMedia,
      });
      options.applyProject(result.project, result.slideId);
      return result;
    },
    ...(visualCapability
      ? {
          getSlidePreview: (input: { slideNumber: number }) =>
            visualCapability.getSlidePreview(input),
          exportPresentation: (
            input: Parameters<NonNullable<AuthoringAutomationDelegate['exportPresentation']>>[0],
            report: Parameters<NonNullable<AuthoringAutomationDelegate['exportPresentation']>>[1],
          ) => visualCapability.exportPresentation(input, report),
        }
      : {}),
  };
}
