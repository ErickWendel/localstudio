import type { AuthoringResult } from '../automation/authoringAutomationController';
import { authoringAutomationController } from '../automation/authoringAutomationController';
import type { SlideUpsertBatch } from '../automation/slideUpsertService';
import { promptRecipes } from '../../ui/editor/prompting/promptRecipes';
import { slideUpsertInputSchema } from './slideUpsertInputSchema';

type ToolInput = Record<string, unknown>;
type AuthoringAutomationController = InstanceType<
  typeof authoringAutomationController.AuthoringAutomationController
>;

export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMcpTool {
  annotations?: WebMcpToolAnnotations;
  description: string;
  execute(input: ToolInput): Promise<AuthoringResult<unknown>> | AuthoringResult<unknown>;
  inputSchema: Record<string, unknown>;
  name: string;
  title: string;
}

export interface WebMcpModelContext {
  registerTool?: (tool: WebMcpTool) => unknown;
  registerTools?: (tools: WebMcpTool[]) => unknown;
}

export interface WebMcpDemoWindow extends Window {
  localStudioWebMcpTools?: WebMcpTool[];
}

function stringInput(input: ToolInput, key: string) {
  return typeof input[key] === 'string' ? input[key] : '';
}

function optionalStringInput(input: ToolInput, key: string) {
  const value = stringInput(input, key).trim();
  return value || undefined;
}

function optionalNumberInput(input: ToolInput, key: string) {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalBooleanInput(input: ToolInput, key: string) {
  return typeof input[key] === 'boolean' ? input[key] : undefined;
}

function optionalStringArrayInput(input: ToolInput, key: string) {
  const value = input[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

function optionalNumberArrayInput(input: ToolInput, key: string) {
  const value = input[key];
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : undefined;
}

function isCleanupCallback(value: unknown): value is () => void {
  return typeof value === 'function';
}

function isDuplicateToolNameError(error: unknown) {
  if (!(error instanceof DOMException || error instanceof Error)) return false;
  return error.name === 'InvalidStateError' && error.message.includes('Duplicate tool name');
}

const emptyObjectSchema = { type: 'object', additionalProperties: false, properties: {} };
const operationAnnotations = { readOnlyHint: false, untrustedContentHint: true };
const readerAnnotations = { readOnlyHint: true, untrustedContentHint: true };

export class WebMcpToolAdapter {
  constructor(private readonly controller: AuthoringAutomationController) {}

  createTools(): WebMcpTool[] {
    return [
      {
        name: 'create_presentation',
        title: 'Create presentation',
        description:
          'Create a blank LocalStudio presentation with an explicit name and optional canvas dimensions.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', maxLength: 200 },
            width: { type: 'number', minimum: 1, maximum: 10000 },
            height: { type: 'number', minimum: 1, maximum: 10000 },
          },
        },
        execute: (input) =>
          this.controller.createPresentation({
            ...(optionalStringInput(input, 'name')
              ? { name: optionalStringInput(input, 'name') }
              : {}),
            ...(optionalNumberInput(input, 'width') !== undefined
              ? { width: optionalNumberInput(input, 'width') }
              : {}),
            ...(optionalNumberInput(input, 'height') !== undefined
              ? { height: optionalNumberInput(input, 'height') }
              : {}),
          }),
      },
      {
        name: 'get_presentation_state',
        title: 'Inspect presentation state',
        description:
          'Return bounded project and slide state. Detailed element data is limited to five slides per call.',
        annotations: readerAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            detail: { type: 'string', enum: ['summary', 'elements'] },
            slideNumbers: { type: 'array', items: { type: 'integer', minimum: 1 }, maxItems: 5 },
            cursor: { type: 'integer', minimum: 0 },
            elementCursor: { type: 'integer', minimum: 0 },
            elementLimit: { type: 'integer', minimum: 1, maximum: 50 },
          },
        },
        execute: (input) =>
          this.controller.getPresentationState({
            detail: stringInput(input, 'detail') === 'elements' ? 'elements' : 'summary',
            ...(optionalNumberArrayInput(input, 'slideNumbers')
              ? { slideNumbers: optionalNumberArrayInput(input, 'slideNumbers') }
              : {}),
            ...(optionalNumberInput(input, 'cursor') !== undefined
              ? { cursor: optionalNumberInput(input, 'cursor') }
              : {}),
            ...(optionalNumberInput(input, 'elementCursor') !== undefined
              ? { elementCursor: optionalNumberInput(input, 'elementCursor') }
              : {}),
            ...(optionalNumberInput(input, 'elementLimit') !== undefined
              ? { elementLimit: optionalNumberInput(input, 'elementLimit') }
              : {}),
          }),
      },
      {
        name: 'import_powerpoint_from_url',
        title: 'Import PowerPoint from URL',
        description:
          'Import a PPTX from an authorized HTTP(S), presigned object-storage, or localhost URL using the native PowerPoint workflow.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['url'],
          properties: {
            url: { type: 'string', minLength: 1, maxLength: 8000 },
            fileName: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
        execute: (input) =>
          this.controller.importPowerPointFromUrl({
            url: stringInput(input, 'url'),
            ...(optionalStringInput(input, 'fileName')
              ? { fileName: optionalStringInput(input, 'fileName') }
              : {}),
          }),
      },
      {
        name: 'translate_deck_and_notes',
        title: 'Translate deck and notes',
        description:
          'Translate all visible text, speaker notes, and existing semantic descriptions in the presentation.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['targetLanguage'],
          properties: {
            targetLanguage: { type: 'string', minLength: 1, maxLength: 100 },
            sourceLanguage: { type: 'string', minLength: 1, maxLength: 100 },
          },
        },
        execute: (input) =>
          this.controller.translateDeckAndNotes({
            targetLanguage: stringInput(input, 'targetLanguage'),
            ...(optionalStringInput(input, 'sourceLanguage')
              ? { sourceLanguage: optionalStringInput(input, 'sourceLanguage') }
              : {}),
          }),
      },
      {
        name: 'generate_deck_detailed_description',
        title: 'Generate detailed deck descriptions',
        description:
          'Generate fresh hidden semantic descriptions from structured slide content for attendee AI grounding.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            slideNumbers: {
              type: 'array',
              maxItems: 100,
              uniqueItems: true,
              items: { type: 'integer', minimum: 1 },
            },
            language: { type: 'string', minLength: 1, maxLength: 100 },
            force: { type: 'boolean' },
          },
        },
        execute: (input) =>
          this.controller.generateDeckDetailedDescription({
            ...(optionalNumberArrayInput(input, 'slideNumbers')
              ? { slideNumbers: optionalNumberArrayInput(input, 'slideNumbers') }
              : {}),
            ...(optionalStringInput(input, 'language')
              ? { language: optionalStringInput(input, 'language') }
              : {}),
            ...(optionalBooleanInput(input, 'force') !== undefined
              ? { force: optionalBooleanInput(input, 'force') }
              : {}),
          }),
      },
      {
        name: 'list_authoring_catalog',
        title: 'List authoring catalog',
        description:
          'List usable fonts or animations compatible with a text, image, GIF, video, or shape element.',
        annotations: readerAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['kind'],
          allOf: [
            {
              if: { properties: { kind: { const: 'animations' } } },
              then: { required: ['elementType'] },
            },
          ],
          properties: {
            kind: { type: 'string', enum: ['fonts', 'animations'] },
            elementType: { type: 'string', enum: ['text', 'image', 'gif', 'video', 'shape'] },
          },
        },
        execute: (input) =>
          this.controller.listAuthoringCatalog({
            kind: stringInput(input, 'kind') as 'fonts' | 'animations',
            ...(optionalStringInput(input, 'elementType')
              ? {
                  elementType: optionalStringInput(input, 'elementType') as
                    | 'text'
                    | 'image'
                    | 'gif'
                    | 'video'
                    | 'shape',
                }
              : {}),
          }),
      },
      {
        name: 'upsert_slide_content',
        title: 'Upsert exact slide content',
        description:
          'Atomically merge or replace exact slide primitives using stable IDs, frames, z-indexes, styles, media, and animations.',
        annotations: operationAnnotations,
        inputSchema: slideUpsertInputSchema,
        execute: (input) =>
          this.controller.upsertSlideContent(input as unknown as SlideUpsertBatch),
      },
      {
        name: 'generate_image',
        title: 'Generate image asset',
        description: `Generate an image asset without placing it. Use its assetId in upsert_slide_content. Example: ${promptRecipes.imagePromptExamples[0]}`,
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['prompt'],
          properties: {
            prompt: { type: 'string', minLength: 1, maxLength: 10000 },
            width: { type: 'integer', minimum: 64, maximum: 4096 },
            height: { type: 'integer', minimum: 64, maximum: 4096 },
            seed: { type: 'integer' },
            steps: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
        execute: (input) =>
          this.controller.generateImage({
            prompt: stringInput(input, 'prompt'),
            ...(optionalNumberInput(input, 'width') !== undefined
              ? { width: optionalNumberInput(input, 'width') }
              : {}),
            ...(optionalNumberInput(input, 'height') !== undefined
              ? { height: optionalNumberInput(input, 'height') }
              : {}),
            ...(optionalNumberInput(input, 'seed') !== undefined
              ? { seed: optionalNumberInput(input, 'seed') }
              : {}),
            ...(optionalNumberInput(input, 'steps') !== undefined
              ? { steps: optionalNumberInput(input, 'steps') }
              : {}),
          }),
      },
      {
        name: 'get_slide_preview',
        title: 'Focus slide preview',
        description:
          'Select and fit a slide in the visible editor for browser-vision inspection and return its render hash.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['slideNumber'],
          properties: { slideNumber: { type: 'integer', minimum: 1 } },
        },
        execute: (input) =>
          this.controller.getSlidePreview({
            slideNumber: optionalNumberInput(input, 'slideNumber') ?? 0,
          }),
      },
      {
        name: 'get_ai_model_status',
        title: 'Inspect AI model status',
        description:
          'Report browser compatibility, selected providers, model readiness, sizes, progress, and errors.',
        annotations: readerAnnotations,
        inputSchema: emptyObjectSchema,
        execute: () => this.controller.getAiModelStatus(),
      },
      {
        name: 'prepare_ai_models',
        title: 'Prepare AI models',
        description:
          'Download required AI models or explicit model IDs and expose progress through get_operation_status.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            modelIds: {
              type: 'array',
              maxItems: 50,
              uniqueItems: true,
              items: { type: 'string', minLength: 1, maxLength: 500 },
            },
          },
        },
        execute: (input) =>
          this.controller.prepareAiModels({
            ...(optionalStringArrayInput(input, 'modelIds')
              ? { modelIds: optionalStringArrayInput(input, 'modelIds') }
              : {}),
          }),
      },
      {
        name: 'search_media',
        title: 'Search stock media',
        description:
          'Search configured Unsplash images or Giphy GIFs and return bounded media references with attribution.',
        annotations: readerAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'term'],
          properties: {
            kind: { type: 'string', enum: ['image', 'gif'] },
            term: { type: 'string', minLength: 1, maxLength: 500 },
            limit: { type: 'integer', minimum: 1, maximum: 30 },
          },
        },
        execute: (input) =>
          this.controller.searchMedia({
            kind: stringInput(input, 'kind') as 'image' | 'gif',
            term: stringInput(input, 'term'),
            ...(optionalNumberInput(input, 'limit') !== undefined
              ? { limit: optionalNumberInput(input, 'limit') }
              : {}),
          }),
      },
      {
        name: 'export_presentation',
        title: 'Export presentation',
        description:
          'Export as PPTX, PDF, PNG archive, or JPEG archive using the visible editor render path.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['format'],
          properties: {
            format: { type: 'string', enum: ['pptx', 'pdf', 'png', 'jpeg'] },
            slideRange: { type: 'string', enum: ['all', 'current'] },
            includeAnimationFrames: { type: 'boolean' },
          },
        },
        execute: (input) =>
          this.controller.exportPresentation({
            format: stringInput(input, 'format') as 'pptx' | 'pdf' | 'png' | 'jpeg',
            ...(optionalStringInput(input, 'slideRange')
              ? { slideRange: optionalStringInput(input, 'slideRange') as 'all' | 'current' }
              : {}),
            ...(optionalBooleanInput(input, 'includeAnimationFrames') !== undefined
              ? { includeAnimationFrames: optionalBooleanInput(input, 'includeAnimationFrames') }
              : {}),
          }),
      },
      {
        name: 'publish_presentation',
        title: 'Publish presentation',
        description:
          'Publish the exact current revision, fonts, descriptions, transcript, and authorized recording media.',
        annotations: operationAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            shareId: { type: 'string', minLength: 1, maxLength: 128 },
            expectedRevision: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
        execute: (input) =>
          this.controller.publishPresentation({
            ...(optionalStringInput(input, 'shareId')
              ? { shareId: optionalStringInput(input, 'shareId') }
              : {}),
            ...(optionalStringInput(input, 'expectedRevision')
              ? { expectedRevision: optionalStringInput(input, 'expectedRevision') }
              : {}),
          }),
      },
      {
        name: 'get_operation_status',
        title: 'Get authoring operation status',
        description:
          'Read queued, running, completed, or failed progress and the typed final result.',
        annotations: readerAnnotations,
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['operationId'],
          properties: {
            operationId: { type: 'string', minLength: 1, maxLength: 500 },
            waitForChangeMs: { type: 'integer', minimum: 0, maximum: 5000 },
          },
        },
        execute: (input) =>
          this.controller.getOperationStatus({
            operationId: stringInput(input, 'operationId'),
            ...(optionalNumberInput(input, 'waitForChangeMs') !== undefined
              ? { waitForChangeMs: optionalNumberInput(input, 'waitForChangeMs') }
              : {}),
          }),
      },
    ];
  }

  register(modelContext: WebMcpModelContext): () => void {
    const tools = this.createTools();
    const cleanups: Array<() => void> = [];
    if (modelContext.registerTools) {
      try {
        const cleanup = modelContext.registerTools(tools);
        if (isCleanupCallback(cleanup)) cleanups.push(cleanup);
      } catch (error) {
        if (!isDuplicateToolNameError(error)) throw error;
      }
    } else {
      tools.forEach((tool) => {
        try {
          const cleanup = modelContext.registerTool?.(tool);
          if (isCleanupCallback(cleanup)) cleanups.push(cleanup);
        } catch (error) {
          if (!isDuplicateToolNameError(error)) throw error;
        }
      });
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }
}
