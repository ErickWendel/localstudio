import type {
  PresentationExportProgress,
  PresentationExportResult,
  PresentationExportWarning,
} from '../../../services/contracts/interfaces';
import type { PptxImportInput } from '../../../services/importing/pptx/pptxImportService';
import { pptxImportLogger } from '../../../services/importing/pptx/pptxImportLogger';

type WindowWithPowerPointPicker = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options?: {
      excludeAcceptAllOption?: boolean;
      multiple?: boolean;
      types?: Array<{
        accept: Record<string, string[]>;
        description: string;
      }>;
    }) => Promise<FileSystemFileHandle[]>;
  };

const localPptxSampleImportParam = 'importPptxSample';
const localPptxSampleImportRoute = '/__localstudio/pptx-sample/file';
const localPptxSampleFileName = 'fullstack-monitoring-jsnation-11062026.pptx';

function isDomError(error: unknown, name: string) {
  return (
    (error instanceof DOMException && error.name === name) ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === name)
  );
}

async function pickImportInput(): Promise<PptxImportInput | null> {
  if (typeof window === 'undefined') return null;
  const pickerWindow = window as WindowWithPowerPointPicker;
  if (pickerWindow.showOpenFilePicker) {
    try {
      pptxImportLogger.info('Opening PowerPoint file picker.');
      const handles = await pickerWindow.showOpenFilePicker({
        excludeAcceptAllOption: false,
        multiple: false,
        types: [
          {
            description: 'PowerPoint presentation',
            accept: {
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
              'application/zip': ['.pptx'],
            },
          },
        ],
      });
      const handle = handles[0];
      if (!handle) return null;
      pptxImportLogger.info('PowerPoint file handle selected.', { name: handle.name });
      const file = await handle.getFile();
      pptxImportLogger.info('PowerPoint file handle read.', {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      return { file };
    } catch (error) {
      if (isDomError(error, 'AbortError')) {
        pptxImportLogger.info('PowerPoint file picker was cancelled.');
        return null;
      }
      pptxImportLogger.error('PowerPoint file picker failed.', error);
      throw error;
    }
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const file = await new Promise<File | undefined>((resolve) => {
    input.addEventListener('change', () => resolve(input.files?.[0]));
    input.click();
  });
  if (file) return { file };
  return null;
}

async function loadLocalSampleInput(): Promise<PptxImportInput> {
  const response = await fetch(localPptxSampleImportRoute);
  if (!response.ok) {
    throw new Error(`Sample PowerPoint could not be loaded (${response.status}).`);
  }
  const blob = await response.blob();
  return {
    file: new File([blob], localPptxSampleFileName, {
      type:
        blob.type ||
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }),
  };
}

function consumeLocalSampleImportRequest() {
  if (typeof window === 'undefined') return false;
  const nextUrl = new URL(window.location.href);
  if (nextUrl.searchParams.get(localPptxSampleImportParam) !== '1') return false;
  nextUrl.searchParams.delete(localPptxSampleImportParam);
  window.history.replaceState(
    window.history.state,
    '',
    `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
  );
  return true;
}

function pluralizeCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function getWarningCategory(warning: PresentationExportWarning) {
  if (warning.category === 'animation') return 'animation';
  if (warning.category === 'transition') return 'transition';
  if (
    warning.category === 'content-type' ||
    warning.category === 'fidelity' ||
    warning.category === 'media' ||
    warning.category === 'relationship'
  ) {
    return 'media';
  }
  if (warning.code.includes('animation')) return 'animation';
  if (warning.code.includes('transition')) return 'transition';
  if (warning.code.includes('media') || warning.code.includes('video') || warning.code.includes('asset')) {
    return 'media';
  }
  return 'other';
}

function summarizeExport(result: PresentationExportResult) {
  const stats = [
    pluralizeCount(result.stats.slideCount, 'slide'),
    pluralizeCount(result.stats.mediaElementCount, 'media item'),
    pluralizeCount(result.stats.animationBuildCount, 'animation build'),
  ];
  if (result.warnings.length === 0) return `PowerPoint exported: ${stats.join(', ')}.`;

  const counts = result.warnings.reduce(
    (summary, warning) => {
      summary[getWarningCategory(warning)] += 1;
      return summary;
    },
    { animation: 0, media: 0, other: 0, transition: 0 },
  );
  const fallbackParts = [
    counts.animation > 0 ? pluralizeCount(counts.animation, 'animation fallback') : undefined,
    counts.transition > 0 ? pluralizeCount(counts.transition, 'transition fallback') : undefined,
    counts.media > 0 ? pluralizeCount(counts.media, 'media fallback') : undefined,
    counts.other > 0 ? pluralizeCount(counts.other, 'fallback') : undefined,
  ].filter(Boolean);

  return `PowerPoint exported: ${stats.join(', ')}; ${fallbackParts.join(', ')}.`;
}

function getExportProgressValue(progress: PresentationExportProgress) {
  if (
    progress.current === undefined ||
    progress.total === undefined ||
    progress.total <= 0
  ) {
    return undefined;
  }
  return {
    current: Math.min(progress.total, Math.max(0, progress.current)),
    total: progress.total,
  };
}

function formatExportProgress(progress: PresentationExportProgress) {
  return {
    detail: progress.detail,
    message: progress.label,
    progress: getExportProgressValue(progress),
    tone: 'info' as const,
  };
}

export const powerPointIo = {
  consumeLocalSampleImportRequest,
  formatExportProgress,
  loadLocalSampleInput,
  pickImportInput,
  summarizeExport,
};
