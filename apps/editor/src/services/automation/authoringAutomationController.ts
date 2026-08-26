import type { ModelState } from '../contracts/interfaces';
import type { SlideUpsertBatch, SlideUpsertResult } from './slideUpsertService';
import {
  AuthoringOperationRegistry,
  type AuthoringOperationProgress,
} from './authoringOperationRegistry';

export type AuthoringResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string; message: string };

export interface AuthoringProgressReporter {
  (progress: Partial<AuthoringOperationProgress>): void;
}

export interface AuthoringAutomationDelegate {
  createPresentation(input: {
    name?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }): unknown;
  getPresentationState(input: {
    detail?: 'summary' | 'elements' | undefined;
    slideNumbers?: number[] | undefined;
    cursor?: number | undefined;
    elementCursor?: number | undefined;
    elementLimit?: number | undefined;
  }): unknown;
  importPowerPointFromUrl?(
    input: { url: string; fileName?: string | undefined },
    report: AuthoringProgressReporter,
  ): Promise<unknown>;
  translateDeckAndNotes?(
    input: { targetLanguage: string; sourceLanguage?: string | undefined },
    report: AuthoringProgressReporter,
  ): Promise<unknown>;
  generateDeckDetailedDescription?(
    input: {
      slideNumbers?: number[] | undefined;
      language?: string | undefined;
      force?: boolean | undefined;
    },
    report: AuthoringProgressReporter,
  ): Promise<unknown>;
  listAuthoringCatalog?(input: {
    kind: 'fonts' | 'animations';
    elementType?: 'text' | 'image' | 'gif' | 'video' | 'shape' | undefined;
  }): unknown;
  upsertSlideContent(input: SlideUpsertBatch): Promise<SlideUpsertResult>;
  generateImage?(
    input: {
      prompt: string;
      width?: number | undefined;
      height?: number | undefined;
      seed?: number | undefined;
      steps?: number | undefined;
    },
    report: AuthoringProgressReporter,
  ): Promise<unknown>;
  getSlidePreview?(input: { slideNumber: number }): unknown;
  getAiModelStatus?(): Promise<unknown>;
  prepareAiModels?(
    input: { modelIds?: string[] | undefined },
    report: AuthoringProgressReporter,
  ): Promise<ModelState[]>;
  searchMedia?(input: {
    kind: 'image' | 'gif';
    term: string;
    limit?: number | undefined;
  }): Promise<unknown>;
  exportPresentation?(
    input: {
      format: 'pptx' | 'pdf' | 'png' | 'jpeg';
      slideRange?: 'all' | 'current' | undefined;
      includeAnimationFrames?: boolean | undefined;
    },
    report: AuthoringProgressReporter,
  ): Promise<unknown>;
  publishPresentation?(
    input: { shareId?: string | undefined },
    report: AuthoringProgressReporter,
  ): Promise<unknown>;
}

function success<T>(data: T): AuthoringResult<T> {
  return { ok: true, data };
}

function failure<T = never>(errorCode: string, message: string): AuthoringResult<T> {
  return { ok: false, errorCode, message };
}

function operationStarted(status: { operationId: string; state: string }) {
  return success({ operationId: status.operationId, status: status.state });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

class AuthoringAutomationController {
  private readonly operations = new AuthoringOperationRegistry();
  private readonly upserts = new Map<
    string,
    { inputKey: string; promise: Promise<SlideUpsertResult> }
  >();

  constructor(private readonly delegate: AuthoringAutomationDelegate) {}

  async createPresentation(input: {
    name?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }): Promise<AuthoringResult<unknown>> {
    try {
      await Promise.allSettled([...this.upserts.values()].map(({ promise }) => promise));
      const result = await this.delegate.createPresentation(input);
      this.upserts.clear();
      return success(result);
    } catch (error) {
      return failure('create_presentation', this.describeError(error));
    }
  }

  async getPresentationState(input: {
    detail?: 'summary' | 'elements' | undefined;
    slideNumbers?: number[] | undefined;
    cursor?: number | undefined;
    elementCursor?: number | undefined;
    elementLimit?: number | undefined;
  }): Promise<AuthoringResult<unknown>> {
    try {
      return success(await this.delegate.getPresentationState(input));
    } catch (error) {
      return failure('get_presentation_state', this.describeError(error));
    }
  }

  importPowerPointFromUrl(input: { url: string; fileName?: string | undefined }) {
    if (!input.url.trim()) return failure('invalid_url', 'A PowerPoint URL is required.');
    if (!this.delegate.importPowerPointFromUrl)
      return this.pending('import_powerpoint_from_url', 173);
    const run = this.delegate.importPowerPointFromUrl.bind(this.delegate);
    return operationStarted(
      this.operations.start('fetching-powerpoint', (report) => run(input, report)),
    );
  }

  translateDeckAndNotes(input: { targetLanguage: string; sourceLanguage?: string | undefined }) {
    if (!input.targetLanguage.trim()) {
      return failure('invalid_target_language', 'A target language is required.');
    }
    if (!this.delegate.translateDeckAndNotes) return this.pending('translate_deck_and_notes', 174);
    const run = this.delegate.translateDeckAndNotes.bind(this.delegate);
    return operationStarted(
      this.operations.start('preparing-translation', (report) => run(input, report)),
    );
  }

  generateDeckDetailedDescription(input: {
    slideNumbers?: number[] | undefined;
    language?: string | undefined;
    force?: boolean | undefined;
  }) {
    if (!this.delegate.generateDeckDetailedDescription) {
      return this.pending('generate_deck_detailed_description', 174);
    }
    const run = this.delegate.generateDeckDetailedDescription.bind(this.delegate);
    return operationStarted(
      this.operations.start('describing-slides', (report) => run(input, report)),
    );
  }

  async listAuthoringCatalog(input: {
    kind: 'fonts' | 'animations';
    elementType?: 'text' | 'image' | 'gif' | 'video' | 'shape' | undefined;
  }): Promise<AuthoringResult<unknown>> {
    if (!['fonts', 'animations'].includes(input.kind)) {
      return failure('invalid_catalog', 'Catalog kind must be fonts or animations.');
    }
    if (input.kind === 'animations' && !input.elementType) {
      return failure('missing_element_type', 'Animation discovery requires elementType.');
    }
    if (!this.delegate.listAuthoringCatalog) return this.pending('list_authoring_catalog', 175);
    try {
      return success(await this.delegate.listAuthoringCatalog(input));
    } catch (error) {
      return failure('list_authoring_catalog', this.describeError(error));
    }
  }

  async upsertSlideContent(input: SlideUpsertBatch): Promise<AuthoringResult<unknown>> {
    const cached = this.upserts.get(input.requestId);
    const inputKey = JSON.stringify(canonicalize(input));
    if (cached) {
      if (cached.inputKey !== inputKey) {
        return failure(
          'request_id_conflict',
          `requestId ${input.requestId} was already used with a different batch.`,
        );
      }
      try {
        const result = await cached.promise;
        return success({ ...result, project: undefined, idempotentReplay: true });
      } catch (error) {
        return failure('upsert_slide_content', this.describeError(error));
      }
    }
    const promise = this.delegate.upsertSlideContent(input);
    this.upserts.set(input.requestId, { inputKey, promise });
    try {
      const result = await promise;
      return success({ ...result, project: undefined, idempotentReplay: false });
    } catch (error) {
      this.upserts.delete(input.requestId);
      return failure('upsert_slide_content', this.describeError(error));
    }
  }

  generateImage(input: {
    prompt: string;
    width?: number | undefined;
    height?: number | undefined;
    seed?: number | undefined;
    steps?: number | undefined;
  }) {
    if (!input.prompt.trim()) return failure('empty_prompt', 'An image prompt is required.');
    if (!this.delegate.generateImage) return this.pending('generate_image', 175);
    const run = this.delegate.generateImage.bind(this.delegate);
    return operationStarted(
      this.operations.start('generating-image', (report) => run(input, report)),
    );
  }

  async getSlidePreview(input: { slideNumber: number }): Promise<AuthoringResult<unknown>> {
    if (!this.delegate.getSlidePreview) return this.pending('get_slide_preview', 176);
    try {
      return success(await this.delegate.getSlidePreview(input));
    } catch (error) {
      return failure('get_slide_preview', this.describeError(error));
    }
  }

  async getAiModelStatus(): Promise<AuthoringResult<unknown>> {
    if (!this.delegate.getAiModelStatus) return this.pending('get_ai_model_status', 175);
    try {
      return success(await this.delegate.getAiModelStatus());
    } catch (error) {
      return failure('get_ai_model_status', this.describeError(error));
    }
  }

  prepareAiModels(input: { modelIds?: string[] | undefined }) {
    if (!this.delegate.prepareAiModels) return this.pending('prepare_ai_models', 175);
    const run = this.delegate.prepareAiModels.bind(this.delegate);
    return operationStarted(
      this.operations.start('preparing-ai-models', (report) => run(input, report)),
    );
  }

  async searchMedia(input: {
    kind: 'image' | 'gif';
    term: string;
    limit?: number | undefined;
  }): Promise<AuthoringResult<unknown>> {
    if (!['image', 'gif'].includes(input.kind)) {
      return failure('invalid_media_kind', 'Media kind must be image or gif.');
    }
    if (!this.delegate.searchMedia) return this.pending('search_media', 175);
    try {
      return success(await this.delegate.searchMedia(input));
    } catch (error) {
      return failure('search_media', this.describeError(error));
    }
  }

  exportPresentation(input: {
    format: 'pptx' | 'pdf' | 'png' | 'jpeg';
    slideRange?: 'all' | 'current' | undefined;
    includeAnimationFrames?: boolean | undefined;
  }) {
    if (!['pptx', 'pdf', 'png', 'jpeg'].includes(input.format)) {
      return failure('invalid_export_format', 'Export format must be pptx, pdf, png, or jpeg.');
    }
    if (!this.delegate.exportPresentation) return this.pending('export_presentation', 176);
    const run = this.delegate.exportPresentation.bind(this.delegate);
    return operationStarted(
      this.operations.start('exporting-presentation', (report) => run(input, report)),
    );
  }

  publishPresentation(input: { shareId?: string | undefined }) {
    if (!this.delegate.publishPresentation) return this.pending('publish_presentation', 177);
    const run = this.delegate.publishPresentation.bind(this.delegate);
    return operationStarted(
      this.operations.start('publishing-presentation', (report) => run(input, report)),
    );
  }

  async getOperationStatus(input: {
    operationId: string;
    waitForChangeMs?: number | undefined;
  }): Promise<AuthoringResult<unknown>> {
    const initial = this.operations.get(input.operationId);
    if (!initial) return failure('unknown_operation', `Unknown operation: ${input.operationId}.`);
    const waitMs = Math.max(0, Math.min(5_000, input.waitForChangeMs ?? 0));
    if (waitMs > 0 && ['queued', 'running'].includes(initial.state)) {
      const revision = initial.revision;
      const deadline = Date.now() + waitMs;
      while (Date.now() < deadline) {
        await new Promise((resolve) =>
          globalThis.setTimeout(resolve, Math.min(100, deadline - Date.now())),
        );
        const next = this.operations.get(input.operationId);
        if (!next || next.revision !== revision) break;
      }
    }
    return success(this.operations.get(input.operationId));
  }

  private describeError(error: unknown) {
    return error instanceof Error ? error.message : 'Authoring action failed.';
  }

  private pending(toolName: string, issueNumber: number): AuthoringResult<never> {
    return failure(
      'capability_pending',
      `${toolName} is reserved in the authoring catalog and will be implemented in #${issueNumber}.`,
    );
  }
}

export const authoringAutomationController = { AuthoringAutomationController };
