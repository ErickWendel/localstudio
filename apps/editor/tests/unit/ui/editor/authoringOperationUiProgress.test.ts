import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { AuthoringOperationStatus } from '../../../../src/services/automation/authoringOperationRegistry';
import { authoringOperationUiProgress } from '../../../../src/ui/editor/state/authoringOperationUiProgress';

function createStatus(
  overrides: Partial<AuthoringOperationStatus> = {},
): AuthoringOperationStatus {
  return {
    createdAt: '2026-08-29T00:00:00.000Z',
    operationId: 'operation-1',
    percentage: 25,
    progress: 25,
    revision: 1,
    stage: 'translating-slides',
    state: 'running',
    updatedAt: '2026-08-29T00:00:01.000Z',
    warnings: [],
    ...overrides,
  };
}

function createActions() {
  return {
    setDeckTranslationProgress: vi.fn(),
    setIsTranslating: vi.fn(),
    setPresentationImportProgress: vi.fn(),
    showOperationNotice: vi.fn(),
  };
}

describe('authoringOperationUiProgress', () => {
  it('drives the existing deck translation state', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0]!;
    const actions = createActions();

    authoringOperationUiProgress.update(
      {
        operationKind: 'preparing-translation',
        project,
        status: createStatus({ current: 1, detail: page.name, total: project.pages.length }),
      },
      actions,
    );

    expect(actions.setIsTranslating).toHaveBeenCalledWith(true);
    expect(actions.setDeckTranslationProgress).toHaveBeenCalledWith({
      activePageIds: [page.id],
      completedPages: 1,
      currentPageName: page.name,
      totalPages: project.pages.length,
    });
    expect(actions.showOperationNotice).not.toHaveBeenCalled();
  });

  it('drives the existing PowerPoint import state', () => {
    const actions = createActions();
    authoringOperationUiProgress.update(
      {
        operationKind: 'fetching-powerpoint',
        project: sampleProject.createSampleProject(),
        status: createStatus({
          detail: 'Resolving referenced fonts.',
          percentage: 80,
          progress: 80,
          stage: 'resolving-fonts',
        }),
      },
      actions,
    );

    expect(actions.setPresentationImportProgress).toHaveBeenCalledWith({
      detail: 'Resolving referenced fonts.',
      progress: 80,
      stage: 'downloading-fonts',
      title: 'Importing PowerPoint',
    });
    expect(actions.showOperationNotice).not.toHaveBeenCalled();
  });

  it('uses the existing operation notice and clears specialized progress on completion', () => {
    const project = sampleProject.createSampleProject();
    const exportActions = createActions();
    authoringOperationUiProgress.update(
      {
        operationKind: 'exporting-presentation',
        project,
        status: createStatus({ detail: 'Rendering slide 1', percentage: 40, progress: 40 }),
      },
      exportActions,
    );
    expect(exportActions.showOperationNotice).toHaveBeenCalledWith(
      {
        detail: 'Rendering slide 1',
        message: 'Exporting presentation',
        progress: { current: 40, total: 100 },
        tone: 'info',
      },
      { persistent: true },
    );

    const translationActions = createActions();
    authoringOperationUiProgress.update(
      {
        operationKind: 'preparing-translation',
        project,
        status: createStatus({ percentage: 100, progress: 100, stage: 'completed', state: 'completed' }),
      },
      translationActions,
    );
    expect(translationActions.setDeckTranslationProgress).toHaveBeenCalledWith(undefined);
    expect(translationActions.setIsTranslating).toHaveBeenCalledWith(false);
    expect(translationActions.showOperationNotice).toHaveBeenCalledWith({
      message: 'Deck translation completed',
      tone: 'success',
    });
  });
});
