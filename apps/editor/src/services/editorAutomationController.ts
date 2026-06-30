import type { Asset, DesignElement, Page, ProjectDocument, SelectionState } from '../domain/model';
import type { CreateImagePromptOptions } from '../ui/editor/imagePromptOptions';
import { imageSizePresets } from '../ui/editor/imagePromptOptions';

export type AutomationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string; message: string };

export type TranslationScope = 'selection' | 'slide' | 'deck';

export interface EditorAutomationState {
  project: ProjectDocument;
  selection: SelectionState;
}

export interface TranslateTextAutomationInput {
  pageId?: string;
  scope: string;
  targetLanguage: string;
}

export interface GenerateImageAutomationInput extends Partial<CreateImagePromptOptions> {
  prompt: string;
}

export interface EditorAutomationDelegate {
  createProject(input: { name?: string }): Promise<ProjectDocument>;
  generateSlides(input: { prompt: string }): Promise<ProjectDocument>;
  generateImage(input: GenerateImageAutomationInput): Promise<ProjectDocument>;
  translateText(input: TranslateTextAutomationInput & { scope: TranslationScope }): Promise<{
    project: ProjectDocument;
    translatedPageIds: string[];
  }>;
  getState(): EditorAutomationState;
}

export interface ProjectSnapshot {
  projectId: string;
  name: string;
  pages: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    background: Page['background'];
    elementCount: number;
    elements: SnapshotElement[];
  }>;
  assets: Array<Omit<Asset, 'objectUrl'>>;
  selection: SelectionState;
}

type SnapshotElement = Pick<
  DesignElement,
  'height' | 'id' | 'locked' | 'opacity' | 'rotation' | 'type' | 'visible' | 'width' | 'x' | 'y'
> & {
  assetId?: string;
  autoplayInPreview?: boolean;
  controls?: boolean;
  fill?: string;
  loop?: boolean;
  muted?: boolean;
  playing?: boolean;
  text?: string;
  trimEndSeconds?: number | undefined;
  trimStartSeconds?: number;
};

const VALID_TRANSLATION_SCOPES: TranslationScope[] = ['selection', 'slide', 'deck'];
const VALID_IMAGE_DIMENSIONS = new Set(imageSizePresets.flatMap((preset) => [preset.width, preset.height]));

function success<T>(data: T): AutomationResult<T> {
  return { ok: true, data };
}

function failure<T>(errorCode: string, message: string): AutomationResult<T> {
  return { ok: false, errorCode, message };
}

function compactAsset(asset: Asset): Omit<Asset, 'objectUrl'> {
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    mimeType: asset.mimeType,
    ...(asset.fileName ? { fileName: asset.fileName } : {}),
    ...(asset.storage ? { storage: asset.storage } : {}),
  };
}

function compactElement(element: DesignElement): SnapshotElement {
  const base = {
    height: element.height,
    id: element.id,
    locked: element.locked,
    opacity: element.opacity,
    rotation: element.rotation,
    type: element.type,
    visible: element.visible,
    width: element.width,
    x: element.x,
    y: element.y,
  };

  if (element.type === 'text') {
    return { ...base, fill: element.fill, text: element.text };
  }
  if (element.type === 'image') {
    return { ...base, assetId: element.assetId };
  }
  if (element.type === 'gif') {
    return { ...base, assetId: element.assetId, playing: element.playing };
  }
  if (element.type === 'video') {
    return {
      ...base,
      assetId: element.assetId,
      autoplayInPreview: element.autoplayInPreview,
      controls: element.controls,
      loop: element.loop,
      muted: element.muted,
      trimEndSeconds: element.trimEndSeconds,
      trimStartSeconds: element.trimStartSeconds,
    };
  }
  return { ...base, fill: element.fill };
}

export function createProjectSnapshot(state: EditorAutomationState): ProjectSnapshot {
  return {
    projectId: state.project.id,
    name: state.project.name,
    pages: state.project.pages.map((page) => ({
      id: page.id,
      name: page.name,
      width: page.width,
      height: page.height,
      background: page.background,
      elementCount: page.elementIds.length,
      elements: page.elementIds
        .map((elementId) => state.project.elements[elementId])
        .filter((element): element is DesignElement => Boolean(element))
        .map(compactElement),
    })),
    assets: Object.values(state.project.assets).map(compactAsset),
    selection: state.selection,
  };
}

export class EditorAutomationController {
  private activeAction: string | undefined;

  constructor(private readonly delegate: EditorAutomationDelegate) {}

  async createProject(input: { name?: string } = {}): Promise<
    AutomationResult<{ name: string; pageCount: number; projectId: string }>
  > {
    const trimmedName = input.name?.trim();
    const project = await this.delegate.createProject(trimmedName ? { name: trimmedName } : {});
    return success({
      projectId: project.id,
      name: project.name,
      pageCount: project.pages.length,
    });
  }

  async generateSlides(input: { prompt: string }): Promise<AutomationResult<{ snapshot: ProjectSnapshot }>> {
    const prompt = input.prompt.trim();
    if (!prompt) return failure('empty_prompt', 'Enter a prompt before generating slides.');
    return this.runExclusive('generate_slides', async () => {
      const project = await this.delegate.generateSlides({ prompt });
      return success({ snapshot: createProjectSnapshot({ ...this.delegate.getState(), project }) });
    });
  }

  async generateImage(input: GenerateImageAutomationInput): Promise<AutomationResult<{ snapshot: ProjectSnapshot }>> {
    const prompt = input.prompt.trim();
    if (!prompt) return failure('empty_prompt', 'Enter a prompt before generating an image.');
    if (input.width !== undefined && !VALID_IMAGE_DIMENSIONS.has(input.width)) {
      return failure('invalid_image_dimensions', 'Image width must match one of the supported prompt presets.');
    }
    if (input.height !== undefined && !VALID_IMAGE_DIMENSIONS.has(input.height)) {
      return failure('invalid_image_dimensions', 'Image height must match one of the supported prompt presets.');
    }
    return this.runExclusive('generate_image', async () => {
      const project = await this.delegate.generateImage({ ...input, prompt });
      return success({ snapshot: createProjectSnapshot({ ...this.delegate.getState(), project }) });
    });
  }

  async translateText(input: TranslateTextAutomationInput): Promise<
    AutomationResult<{ snapshot: ProjectSnapshot; translatedPageIds: string[] }>
  > {
    if (!VALID_TRANSLATION_SCOPES.includes(input.scope as TranslationScope)) {
      return failure('invalid_translation_scope', 'Translation scope must be selection, slide, or deck.');
    }
    const targetLanguage = input.targetLanguage.trim();
    if (!targetLanguage) return failure('empty_target_language', 'Choose a target language before translating.');
    return this.runExclusive('translate_text', async () => {
      const result = await this.delegate.translateText({
        ...input,
        scope: input.scope as TranslationScope,
        targetLanguage,
      });
      return success({
        translatedPageIds: result.translatedPageIds,
        snapshot: createProjectSnapshot({ ...this.delegate.getState(), project: result.project }),
      });
    });
  }

  getProjectSnapshot(): AutomationResult<{ snapshot: ProjectSnapshot }> {
    return success({ snapshot: createProjectSnapshot(this.delegate.getState()) });
  }

  private async runExclusive<T>(action: string, run: () => Promise<AutomationResult<T>>): Promise<AutomationResult<T>> {
    if (this.activeAction) {
      return failure('busy', 'Another automation action is already running.');
    }
    this.activeAction = action;
    try {
      return await run();
    } catch (error) {
      return failure(action, error instanceof Error ? error.message : 'Automation action failed.');
    } finally {
      this.activeAction = undefined;
    }
  }
}
