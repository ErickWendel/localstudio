import { authoringAutomationController } from '../../../src/services/automation/authoringAutomationController';
import type { AuthoringAutomationDelegate } from '../../../src/services/automation/authoringAutomationController';
import type { AuthoringOperationStatus } from '../../../src/services/automation/authoringOperationRegistry';
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
    const onOperationStatusChange = vi.fn<(status: AuthoringOperationStatus) => void>();
    const controller = new authoringAutomationController.AuthoringAutomationController(
      createDelegate({
        importPowerPointFromUrl: (_input, report) => {
          report({ stage: 'importing-powerpoint', progress: 60, current: 2, total: 3 });
          return Promise.resolve({ pageCount: 3 });
        },
      }),
      { onOperationStatusChange },
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
    expect(onOperationStatusChange.mock.calls.map(([status]) => status.state)).toEqual([
      'queued',
      'running',
      'running',
      'completed',
    ]);
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

  it('scopes idempotent request IDs to the current presentation', async () => {
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
      requestId: 'reusable-after-create',
      slideNumber: 1,
      mode: 'merge',
      elements: [],
    };

    await expect(controller.upsertSlideContent(input)).resolves.toMatchObject({
      ok: true,
      data: { idempotentReplay: false },
    });
    await controller.createPresentation({ name: 'A different deck' });
    await expect(controller.upsertSlideContent(input)).resolves.toMatchObject({
      ok: true,
      data: { idempotentReplay: false },
    });
    expect(upsertSlideContent).toHaveBeenCalledTimes(2);
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
});
