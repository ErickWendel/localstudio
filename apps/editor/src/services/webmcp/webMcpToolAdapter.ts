import type {
  AutomationResult,
  GenerateImageAutomationInput,
  TranslateTextAutomationInput,
} from '../automation/editorAutomationController';
import { editorAutomationController } from '../automation/editorAutomationController';
import { promptRecipes } from '../../ui/editor/prompting/promptRecipes';

type ToolInput = Record<string, unknown>;
type EditorAutomationController = InstanceType<typeof editorAutomationController.EditorAutomationController>;

export interface WebMcpTool {
  description: string;
  execute(input: ToolInput): Promise<AutomationResult<unknown>> | AutomationResult<unknown>;
  inputSchema: Record<string, unknown>;
  name: string;
}

export interface WebMcpModelContext {
  registerTool?: (tool: WebMcpTool) => unknown;
  registerTools?: (tools: WebMcpTool[]) => unknown;
}

export interface WebMcpDemoWindow extends Window {
  localStudioWebMcpTools?: WebMcpTool[];
}

type ControllerLike = Pick<
  EditorAutomationController,
  'createProject' | 'generateSlides' | 'generateImage' | 'translateText' | 'getProjectSnapshot'
>;

function promptExamplesList(examples: readonly string[]) {
  return examples.map((example) => `- ${example}`).join('\n');
}

function stringInput(input: ToolInput, key: string) {
  const value = input[key];
  return typeof value === 'string' ? value : '';
}

function optionalNumberInput(input: ToolInput, key: string) {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function imageInput(input: ToolInput): GenerateImageAutomationInput {
  const height = optionalNumberInput(input, 'height');
  const seed = optionalNumberInput(input, 'seed');
  const steps = optionalNumberInput(input, 'steps');
  const width = optionalNumberInput(input, 'width');
  return {
    prompt: stringInput(input, 'prompt'),
    ...(height !== undefined ? { height } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(steps !== undefined ? { steps } : {}),
    ...(width !== undefined ? { width } : {}),
  };
}

function translateInput(input: ToolInput): TranslateTextAutomationInput {
  return {
    scope: stringInput(input, 'scope'),
    targetLanguage: stringInput(input, 'targetLanguage'),
    ...(stringInput(input, 'pageId') ? { pageId: stringInput(input, 'pageId') } : {}),
  };
}

function isCleanupCallback(value: unknown): value is () => void {
  return typeof value === 'function';
}

function isDuplicateToolNameError(error: unknown) {
  if (!(error instanceof DOMException || error instanceof Error)) return false;
  return error.name === 'InvalidStateError' && error.message.includes('Duplicate tool name');
}

function collectCleanup(cleanups: Array<() => void>, value: unknown) {
  if (isCleanupCallback(value)) cleanups.push(value);
}

export class WebMcpToolAdapter {
  constructor(private readonly controller: ControllerLike) {}

  createTools(): WebMcpTool[] {
    return [
      {
        name: 'create_project',
        description: 'Create a new blank LocalStudio.dev project in the active editor tab.',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
        execute: (input) => {
          const name = stringInput(input, 'name');
          return this.controller.createProject(name ? { name } : {});
        },
      },
      {
        name: 'generate_slides',
        description: `Generate slide content on the active page from a prompt. Good prompt examples:\n${promptExamplesList(promptRecipes.slidePromptExamples)}`,
        inputSchema: {
          type: 'object',
          required: ['prompt'],
          properties: { prompt: { type: 'string' } },
        },
        execute: (input) => this.controller.generateSlides({ prompt: stringInput(input, 'prompt') }),
      },
      {
        name: 'generate_image',
        description: `Generate an image for the active slide. If an image is selected, replace it; otherwise insert a fitted image. Good prompt examples:\n${promptExamplesList(promptRecipes.imagePromptExamples)}`,
        inputSchema: {
          type: 'object',
          required: ['prompt'],
          properties: {
            height: { type: 'number' },
            prompt: { type: 'string' },
            seed: { type: 'number' },
            steps: { type: 'number' },
            width: { type: 'number' },
          },
        },
        execute: (input) => this.controller.generateImage(imageInput(input)),
      },
      {
        name: 'translate_text',
        description: 'Translate visible text in the active LocalStudio.dev project. Scope must be selection, slide, or deck.',
        inputSchema: {
          type: 'object',
          required: ['scope', 'targetLanguage'],
          properties: {
            pageId: { type: 'string' },
            scope: { type: 'string', enum: ['selection', 'slide', 'deck'] },
            targetLanguage: { type: 'string' },
          },
        },
        execute: (input) => this.controller.translateText(translateInput(input)),
      },
      {
        name: 'get_project_snapshot',
        description: 'Return a compact JSON snapshot of the active LocalStudio.dev project without large image payloads.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: () => this.controller.getProjectSnapshot(),
      },
    ];
  }

  register(modelContext: WebMcpModelContext): () => void {
    const tools = this.createTools();
    const cleanups: Array<() => void> = [];
    if (modelContext.registerTools) {
      try {
        collectCleanup(cleanups, modelContext.registerTools(tools));
      } catch (error) {
        if (!isDuplicateToolNameError(error)) throw error;
      }
    } else {
      tools.forEach((tool) => {
        try {
          collectCleanup(cleanups, modelContext.registerTool?.(tool));
        } catch (error) {
          if (!isDuplicateToolNameError(error)) throw error;
        }
      });
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }
}
