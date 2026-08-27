import type { ProjectDocument } from '../../domain/documents/model';
import type { PresentationExportResult, PresentationExportWarning } from '../contracts/interfaces';
import type { AuthoringProgressReporter } from './authoringAutomationController';
import { authoringRevision } from './getAuthoringSlideRevision';

export type AuthoringExportFormat = 'pptx' | 'pdf' | 'png' | 'jpeg';

export interface AuthoringExportInput {
  format: AuthoringExportFormat;
  slideRange?: 'all' | 'current' | undefined;
  includeAnimationFrames?: boolean | undefined;
}

export type AuthoringRenderedExportInput = Omit<AuthoringExportInput, 'format'> & {
  format: Exclude<AuthoringExportFormat, 'pptx'>;
};

export interface AuthoringRenderedExportResult {
  blob: Blob;
  frameCount: number;
  slideCount: number;
  warnings: PresentationExportWarning[];
}

export interface AuthoringExportResult {
  fileName: string;
  format: AuthoringExportFormat;
  slideCount: number;
  warnings: PresentationExportWarning[];
  statistics: {
    animationBuildCount?: number | undefined;
    frameCount?: number | undefined;
    mediaElementCount?: number | undefined;
  };
}

interface CreateAuthoringVisualCapabilityOptions {
  downloadBlob(blob: Blob, fileName: string): void;
  exportPowerPoint(
    project: ProjectDocument,
    report: AuthoringProgressReporter,
  ): Promise<PresentationExportResult>;
  exportRendered(
    project: ProjectDocument,
    input: AuthoringRenderedExportInput,
    report: AuthoringProgressReporter,
  ): Promise<AuthoringRenderedExportResult>;
  focusSlide(pageId: string): void | Promise<void>;
  getActivePageId(): string;
  getProject(): ProjectDocument;
}

const maxExportWarnings = 50;

function getFileName(project: ProjectDocument, format: AuthoringExportFormat) {
  if (format === 'pptx' || format === 'pdf') return `${project.name}.${format}`;
  return `${project.name}-images.zip`;
}

function getScopedProject(
  project: ProjectDocument,
  slideRange: AuthoringExportInput['slideRange'],
  activePageId: string,
) {
  if (slideRange !== 'current') return project;
  const page = project.pages.find((candidate) => candidate.id === activePageId);
  if (!page) throw new Error('The active slide is not available for export.');
  return { ...project, pages: [page] };
}

export function createAuthoringVisualCapability(options: CreateAuthoringVisualCapabilityOptions) {
  return {
    async getSlidePreview(input: { slideNumber: number }) {
      if (!Number.isInteger(input.slideNumber) || input.slideNumber < 1) {
        throw new Error('Provide a valid one-based slideNumber.');
      }
      const project = options.getProject();
      const page = project.pages[input.slideNumber - 1];
      if (!page) throw new Error(`Slide ${input.slideNumber} does not exist.`);
      await options.focusSlide(page.id);
      return {
        slideId: page.id,
        slideNumber: input.slideNumber,
        width: page.width,
        height: page.height,
        elementCount: page.elementIds.length,
        renderHash: authoringRevision.getSlide(project, page.id),
      };
    },

    async exportPresentation(input: AuthoringExportInput, report: AuthoringProgressReporter) {
      const project = options.getProject();
      const scopedProject = getScopedProject(
        project,
        input.slideRange ?? 'all',
        options.getActivePageId(),
      );
      report({ stage: 'preparing', progress: 5, current: 0, total: scopedProject.pages.length });
      const fileName = getFileName(project, input.format);
      if (input.format === 'pptx') {
        const result = await options.exportPowerPoint(scopedProject, report);
        report({ stage: 'downloading', progress: 95, current: 1, total: 1 });
        options.downloadBlob(result.blob, fileName);
        return {
          fileName,
          format: input.format,
          slideCount: result.stats.slideCount,
          warnings: result.warnings.slice(0, maxExportWarnings),
          statistics: {
            animationBuildCount: result.stats.animationBuildCount,
            mediaElementCount: result.stats.mediaElementCount,
          },
        } satisfies AuthoringExportResult;
      }

      const renderedInput: AuthoringRenderedExportInput = {
        ...input,
        format: input.format,
      };
      const result = await options.exportRendered(scopedProject, renderedInput, report);
      report({ stage: 'downloading', progress: 95, current: 1, total: 1 });
      options.downloadBlob(result.blob, fileName);
      return {
        fileName,
        format: input.format,
        slideCount: result.slideCount,
        warnings: result.warnings.slice(0, maxExportWarnings),
        statistics: { frameCount: result.frameCount },
      } satisfies AuthoringExportResult;
    },
  };
}
