import type { AuthoringOperationStatus } from '../../../services/automation/authoringOperationRegistry';
import type { ProjectDocument } from '../../../domain/documents/model';
import type {
  OperationNoticeState,
  PresentationImportProgressState,
} from '../state/useEditorViewModel';

interface DeckTranslationProgress {
  activePageIds: string[];
  completedPages: number;
  currentPageName: string;
  totalPages: number;
}

interface WebMcpEditorProgressInput {
  operationKind: string | undefined;
  project: ProjectDocument;
  status: AuthoringOperationStatus | undefined;
}

const operationMessages: Record<string, string> = {
  'describing-slides': 'Generating detailed descriptions',
  'exporting-presentation': 'Exporting presentation',
  'fetching-powerpoint': 'PowerPoint import',
  'generating-image': 'Generating image',
  'preparing-ai-models': 'Preparing AI models',
  'preparing-translation': 'Deck translation',
};
const specializedOperationKinds = new Set(['fetching-powerpoint', 'preparing-translation']);

function isActive(status: AuthoringOperationStatus) {
  return status.state === 'queued' || status.state === 'running';
}

function getTranslationProgress(
  status: AuthoringOperationStatus,
  project: ProjectDocument,
): DeckTranslationProgress | undefined {
  if (!isActive(status)) return undefined;
  const totalPages = status.total ?? project.pages.length;
  const currentPage = project.pages.find((page) => page.name === status.detail);
  return {
    activePageIds: currentPage ? [currentPage.id] : [],
    completedPages: Math.min(status.current ?? 0, totalPages),
    currentPageName: status.detail || 'Preparing slides',
    totalPages,
  };
}

function getImportProgress(
  status: AuthoringOperationStatus,
): PresentationImportProgressState | undefined {
  if (!isActive(status)) return undefined;
  const stages: Record<string, PresentationImportProgressState['stage']> = {
    'fetching-powerpoint': 'reading',
    'downloading-powerpoint': 'reading',
    'importing-package': 'inspecting',
    'extracting-objects': 'extracting-objects',
    'resolving-fonts': 'downloading-fonts',
    'opening-presentation': 'opening',
  };
  return {
    detail: status.detail || 'Preparing the PowerPoint presentation.',
    progress: status.percentage,
    stage: stages[status.stage] ?? 'reading',
    title: 'Importing PowerPoint',
  };
}

function getOperationNotice(
  status: AuthoringOperationStatus,
  operationKind: string,
): OperationNoticeState | undefined {
  const message = operationMessages[operationKind];
  if ((!message || specializedOperationKinds.has(operationKind)) && isActive(status)) {
    return undefined;
  }
  if (status.state === 'completed') {
    return { message: `${message ?? 'WebMCP operation'} completed`, tone: 'success' };
  }
  if (status.state === 'failed') {
    return {
      detail: status.error,
      message: `${message ?? 'WebMCP operation'} failed`,
      tone: 'error',
    };
  }
  if (!message) return undefined;
  return {
    detail: status.detail,
    message,
    progress: { current: status.percentage, total: 100 },
    tone: 'info',
  };
}

export const webMcpEditorProgress = {
  derive({ operationKind, project, status }: WebMcpEditorProgressInput) {
    if (!status || !operationKind) {
      return {
        importProgress: undefined,
        operationNotice: undefined,
        translationProgress: undefined,
      };
    }
    return {
      importProgress:
        operationKind === 'fetching-powerpoint' ? getImportProgress(status) : undefined,
      operationNotice: getOperationNotice(status, operationKind),
      translationProgress:
        operationKind === 'preparing-translation'
          ? getTranslationProgress(status, project)
          : undefined,
    };
  },
};
