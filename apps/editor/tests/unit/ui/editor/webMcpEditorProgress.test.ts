import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { AuthoringOperationStatus } from '../../../../src/services/automation/authoringOperationRegistry';
import { webMcpEditorProgress } from '../../../../src/ui/editor/shell/webMcpEditorProgress';

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

describe('webMcpEditorProgress', () => {
  it('adapts translation operations to the existing deck translation state', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0]!;

    expect(
      webMcpEditorProgress.derive({
        operationKind: 'preparing-translation',
        project,
        status: createStatus({ current: 1, detail: page.name, total: project.pages.length }),
      }),
    ).toMatchObject({
      operationNotice: undefined,
      translationProgress: {
        activePageIds: [page.id],
        completedPages: 1,
        currentPageName: page.name,
        totalPages: project.pages.length,
      },
    });
  });

  it('adapts URL imports to the existing PowerPoint import overlay', () => {
    const progress = webMcpEditorProgress.derive({
      operationKind: 'fetching-powerpoint',
      project: sampleProject.createSampleProject(),
      status: createStatus({
        detail: 'Resolving referenced fonts.',
        percentage: 80,
        progress: 80,
        stage: 'resolving-fonts',
      }),
    });

    expect(progress.importProgress).toEqual({
      detail: 'Resolving referenced fonts.',
      progress: 80,
      stage: 'downloading-fonts',
      title: 'Importing PowerPoint',
    });
    expect(progress.operationNotice).toBeUndefined();
  });

  it('uses the existing toolbar notice for other operations and terminal results', () => {
    const project = sampleProject.createSampleProject();
    expect(
      webMcpEditorProgress.derive({
        operationKind: 'exporting-presentation',
        project,
        status: createStatus({ detail: 'Rendering slide 1', percentage: 40, progress: 40 }),
      }).operationNotice,
    ).toEqual({
      detail: 'Rendering slide 1',
      message: 'Exporting presentation',
      progress: { current: 40, total: 100 },
      tone: 'info',
    });

    expect(
      webMcpEditorProgress.derive({
        operationKind: 'preparing-translation',
        project,
        status: createStatus({ percentage: 100, progress: 100, stage: 'completed', state: 'completed' }),
      }).operationNotice,
    ).toEqual({ message: 'Deck translation completed', tone: 'success' });
  });
});
