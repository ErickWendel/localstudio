import { authoringAutomationController } from '../../../src/services/automation/authoringAutomationController';
import type { AuthoringAutomationDelegate } from '../../../src/services/automation/authoringAutomationController';
import type { SlideUpsertBatch } from '../../../src/services/automation/slideUpsertService';

function createDelegate(
  overrides: Partial<AuthoringAutomationDelegate> = {},
): AuthoringAutomationDelegate {
  return {
    createPresentation: () => ({}),
    getPresentationState: () => ({}),
    upsertSlideContent: () => Promise.reject(new Error('unused')),
    ...overrides,
  };
}

describe('authoringAutomationController', () => {
  it('reports asynchronous operation progress and completion', async () => {
    const controller = new authoringAutomationController.AuthoringAutomationController(
      createDelegate({
        importPowerPointFromUrl: (_input, report) => {
          report({ stage: 'importing-powerpoint', progress: 60, current: 2, total: 3 });
          return Promise.resolve({ pageCount: 3 });
        },
      }),
    );

    const started = controller.importPowerPointFromUrl({ url: 'https://example.test/deck.pptx' });
    expect(started).toMatchObject({ ok: true, data: { status: 'queued' } });
    const operationId = started.ok ? started.data.operationId : '';
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(controller.getOperationStatus({ operationId })).resolves.toMatchObject({
      ok: true,
      data: {
        state: 'completed',
        progress: 100,
        percentage: 100,
        revision: 3,
        result: { pageCount: 3 },
      },
    });
  });

  it('returns the original result for an idempotent upsert replay', async () => {
    const upsertSlideContent = vi.fn((input: SlideUpsertBatch) =>
      Promise.resolve({
        requestId: input.requestId,
        slideId: 'page-1',
        slideNumber: 1,
        createdSlide: false,
        createdElements: 1,
        updatedElements: 0,
        deletedElements: 0,
        elementCount: 1,
        project: {} as never,
      }),
    );
    const controller = new authoringAutomationController.AuthoringAutomationController(
      createDelegate({ upsertSlideContent }),
    );
    const input = {
      requestId: 'retry-safe',
      slideNumber: 1,
      mode: 'merge' as const,
      elements: [],
    };

    await expect(
      controller.upsertSlideContent({
        elements: input.elements,
        mode: input.mode,
        slideNumber: input.slideNumber,
        requestId: input.requestId,
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { idempotentReplay: false },
    });
    await expect(controller.upsertSlideContent(input)).resolves.toMatchObject({
      ok: true,
      data: { idempotentReplay: true },
    });
    expect(upsertSlideContent).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent retries for the same request ID', async () => {
    const upsertSlideContent = vi.fn((input: SlideUpsertBatch) =>
      Promise.resolve({
        requestId: input.requestId,
        slideId: 'page-1',
        slideNumber: 1,
        createdSlide: false,
        createdElements: 0,
        updatedElements: 0,
        deletedElements: 0,
        elementCount: 0,
        project: {} as never,
      }),
    );
    const controller = new authoringAutomationController.AuthoringAutomationController(
      createDelegate({ upsertSlideContent }),
    );
    const input: SlideUpsertBatch = {
      requestId: 'concurrent',
      slideNumber: 1,
      mode: 'merge',
      elements: [],
    };

    const [first, retry] = await Promise.all([
      controller.upsertSlideContent(input),
      controller.upsertSlideContent(input),
    ]);

    expect(first).toMatchObject({ ok: true, data: { idempotentReplay: false } });
    expect(retry).toMatchObject({ ok: true, data: { idempotentReplay: true } });
    expect(upsertSlideContent).toHaveBeenCalledTimes(1);
  });

  it('rejects a reused request ID when the batch body changes', async () => {
    const upsertSlideContent = vi.fn((input: SlideUpsertBatch) =>
      Promise.resolve({
        requestId: input.requestId,
        slideId: 'page-1',
        slideNumber: 1,
        createdSlide: false,
        createdElements: 0,
        updatedElements: 0,
        deletedElements: 0,
        elementCount: 0,
        project: {} as never,
      }),
    );
    const controller = new authoringAutomationController.AuthoringAutomationController(
      createDelegate({ upsertSlideContent }),
    );

    await controller.upsertSlideContent({
      requestId: 'conflict',
      slideNumber: 1,
      mode: 'merge',
      elements: [],
    });
    await expect(
      controller.upsertSlideContent({
        requestId: 'conflict',
        slideNumber: 1,
        mode: 'replace',
        elements: [],
      }),
    ).resolves.toEqual({
      ok: false,
      errorCode: 'request_id_conflict',
      message: 'requestId conflict was already used with a different batch.',
    });
    expect(upsertSlideContent).toHaveBeenCalledTimes(1);
  });

  it('returns an explicit pending result for reserved catalog capabilities', () => {
    const controller = new authoringAutomationController.AuthoringAutomationController(
      createDelegate(),
    );

    expect(controller.publishPresentation({})).toEqual({
      ok: false,
      errorCode: 'capability_pending',
      message:
        'publish_presentation is reserved in the authoring catalog and will be implemented in #177.',
    });
  });
});
