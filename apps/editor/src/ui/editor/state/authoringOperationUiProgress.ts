import type { ProjectDocument } from '../../../domain/documents/model';
import type { AuthoringOperationStatus } from '../../../services/automation/authoringOperationRegistry';
import type {
  DeckTranslationProgressState,
  OperationNoticeState,
  PresentationImportProgressState,
} from './useEditorViewModel';

interface AuthoringOperationProgressActions {
  setDeckTranslationProgress(progress: DeckTranslationProgressState | undefined): void;
  setIsTranslating(active: boolean): void;
  setPresentationImportProgress(progress: PresentationImportProgressState | undefined): void;
  showOperationNotice(
    notice: OperationNoticeState | undefined,
    options?: { persistent?: boolean },
  ): void;
}

interface AuthoringOperationUiProgressInput {
  operationKind: string;
  project: ProjectDocument;
  status: AuthoringOperationStatus;
}

type ProgressSurface = 'import' | 'notice' | 'translation';

const operationPresentation: Record<string, { message: string; surface: ProgressSurface }> = {
  'describing-slides': { message: 'Generating detailed descriptions', surface: 'notice' },
  'exporting-presentation': { message: 'Exporting presentation', surface: 'notice' },
  'fetching-powerpoint': { message: 'PowerPoint import', surface: 'import' },
  'generating-image': { message: 'Generating image', surface: 'notice' },
  'preparing-ai-models': { message: 'Preparing AI models', surface: 'notice' },
  'preparing-translation': { message: 'Deck translation', surface: 'translation' },
};

const importStages: Record<string, PresentationImportProgressState['stage']> = {
  'fetching-powerpoint': 'reading',
  'downloading-powerpoint': 'reading',
  'importing-package': 'inspecting',
  'extracting-objects': 'extracting-objects',
  'resolving-fonts': 'downloading-fonts',
  'opening-presentation': 'opening',
};

function isActive(status: AuthoringOperationStatus) {
  return status.state === 'queued' || status.state === 'running';
}

function getTerminalNotice(
  status: AuthoringOperationStatus,
  message: string,
): OperationNoticeState | undefined {
  if (status.state === 'completed') return { message: `${message} completed`, tone: 'success' };
  if (status.state !== 'failed') return undefined;
  return { detail: status.error, message: `${message} failed`, tone: 'error' };
}

export const authoringOperationUiProgress = {
  update(
    { operationKind, project, status }: AuthoringOperationUiProgressInput,
    actions: AuthoringOperationProgressActions,
  ) {
    const presentation = operationPresentation[operationKind] ?? {
      message: 'WebMCP operation',
      surface: 'notice' as const,
    };
    if (!isActive(status)) {
      if (presentation.surface === 'translation') {
        actions.setDeckTranslationProgress(undefined);
        actions.setIsTranslating(false);
      }
      if (presentation.surface === 'import') actions.setPresentationImportProgress(undefined);
      actions.showOperationNotice(getTerminalNotice(status, presentation.message));
      return;
    }
    if (presentation.surface === 'translation') {
      const totalPages = status.total ?? project.pages.length;
      const currentPage = project.pages.find((page) => page.name === status.detail);
      actions.setIsTranslating(true);
      actions.setDeckTranslationProgress({
        activePageIds: currentPage ? [currentPage.id] : [],
        completedPages: Math.min(status.current ?? 0, totalPages),
        currentPageName: status.detail || 'Preparing slides',
        totalPages,
      });
      return;
    }
    if (presentation.surface === 'import') {
      actions.setPresentationImportProgress({
        detail: status.detail || 'Preparing the PowerPoint presentation.',
        progress: status.percentage,
        stage: importStages[status.stage] ?? 'reading',
        title: 'Importing PowerPoint',
      });
      return;
    }
    actions.showOperationNotice(
      {
        detail: status.detail,
        message: presentation.message,
        progress: { current: status.percentage, total: 100 },
        tone: 'info',
      },
      { persistent: true },
    );
  },
};
