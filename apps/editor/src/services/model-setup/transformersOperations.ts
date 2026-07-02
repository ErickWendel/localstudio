import { imageGenerationModel } from '../image-generation/imageGenerationModel';
import { progress } from './progress';
import type { ModelDownloadProgressDetails } from '../contracts/interfaces';

const IMAGE_EDITING_TRANSFORMERS_MODEL_ID = 'Xenova/slimsam-77-uniform';

export type TextGenerationInput = string | Array<{ role: string; content: unknown }>;
export type TextGenerationOptions = Record<string, unknown>;

export interface LanguageDetectionResult {
  language: string;
  score?: number | undefined;
}

export interface SamImageInput {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

export interface SamMask {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface SubjectMask {
  data: Uint8Array;
  width: number;
  height: number;
  score: number;
}

export interface SegmentationPoint {
  x: number;
  y: number;
  positive: boolean;
}

export interface BackgroundSegmentationResult {
  imageInput: SamImageInput;
  subjectMask: SubjectMask;
}

interface SamProcessedImage {
  original_sizes: unknown;
  reshaped_input_sizes: Array<[number, number]>;
}

interface EncodedAsset {
  imageInput: SamImageInput;
  imageProcessed: SamProcessedImage;
  imageEmbeddings: Record<string, unknown>;
}

interface SegmentationResult extends EncodedAsset {
  mask: SamMask;
  scores: number[];
}

type TextGenerationPipeline = ((
  prompt: unknown,
  options?: TextGenerationOptions,
) => Promise<unknown>) & {
  dispose?: () => Promise<void> | void;
};

type TextClassificationResult = { label?: unknown; score?: unknown };
type TextClassificationPipeline = ((
  text: string,
  options?: Record<string, unknown>,
) => Promise<unknown>) & {
  dispose?: () => Promise<void> | void;
};

interface SamRuntimeModel {
  dispose?: () => Promise<void> | void;
  get_image_embeddings(image: SamProcessedImage): Promise<Record<string, unknown>>;
  (inputs: Record<string, unknown>): Promise<{
    pred_masks: unknown;
    iou_scores: { data: ArrayLike<number> };
  }>;
}

interface SamRuntimeProcessor {
  (image: SamImageInput): Promise<SamProcessedImage>;
  post_process_masks(
    predMasks: unknown,
    originalSizes: SamProcessedImage['original_sizes'],
    reshapedInputSizes: SamProcessedImage['reshaped_input_sizes'],
  ): Promise<Array<Array<unknown>>>;
}

interface SamRawImageReader {
  fromURL(url: string): Promise<SamImageInput>;
  fromTensor(tensor: unknown): SamMask;
}

interface SamTensorConstructor {
  new (type: 'float32' | 'int64', data: Array<number | bigint>, dims: number[]): unknown;
}

function extractTextFromGeneratedValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const values = value as unknown[];
    const lastMessage = values.at(-1);
    if (lastMessage && typeof lastMessage === 'object') {
      const content = (lastMessage as { content?: unknown }).content;
      if (typeof content === 'string') return content;
      const generatedText = (lastMessage as { generated_text?: unknown }).generated_text;
      const nestedText = extractTextFromGeneratedValue(generatedText);
      if (nestedText) return nestedText;
    }

    const firstMessage = values[0];
    if (firstMessage && typeof firstMessage === 'object') {
      const generatedText = (firstMessage as { generated_text?: unknown }).generated_text;
      const nestedText = extractTextFromGeneratedValue(generatedText);
      if (nestedText) return nestedText;
    }
  }
  if (value && typeof value === 'object' && 'generated_text' in value) {
    return extractTextFromGeneratedValue((value as { generated_text?: unknown }).generated_text);
  }
  return undefined;
}

function extractGeneratedText(result: unknown) {
  if (typeof result === 'string') return result;
  const generatedText = extractTextFromGeneratedValue(result);
  if (generatedText) return generatedText;
  throw new Error('WebGPU text generation did not return text.');
}

function isTextClassificationResult(value: unknown): value is TextClassificationResult {
  return Boolean(value && typeof value === 'object');
}

function getTopClassificationResult(result: unknown): TextClassificationResult | undefined {
  if (Array.isArray(result)) {
    const values: unknown[] = result;
    const first = values[0];
    if (Array.isArray(first)) return getTopClassificationResult(first);
    return isTextClassificationResult(first) ? first : undefined;
  }
  return isTextClassificationResult(result) ? result : undefined;
}

function extractDetectedLanguage(result: unknown): LanguageDetectionResult {
  const topResult = getTopClassificationResult(result);
  const label = topResult?.label;
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error('Language detection model did not return a language label.');
  }

  return {
    language: label,
    ...(typeof topResult?.score === 'number' ? { score: topResult.score } : {}),
  };
}

class DirectTransformersOperations {
  private backgroundModelPromise: Promise<{
    model: SamRuntimeModel;
    processor: SamRuntimeProcessor;
    RawImage: SamRawImageReader;
    Tensor: SamTensorConstructor;
  }> | null = null;
  private encodedAssets = new Map<string, Promise<EncodedAsset>>();
  private languageDetectionPipelines = new Map<string, Promise<TextClassificationPipeline>>();
  private textGenerationPipelines = new Map<string, Promise<TextGenerationPipeline>>();

  async preloadTextGeneration(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    await this.loadTextGenerationPipeline(modelId, options);
  }

  async generateText(
    modelId: string,
    prompt: TextGenerationInput,
    options?: TextGenerationOptions,
  ) {
    const textGeneration = await this.loadTextGenerationPipeline(modelId);
    const generationOptions: TextGenerationOptions = {
      do_sample: false,
      max_new_tokens: 2048,
      ...options,
    };
    if (typeof prompt === 'string' && !('return_full_text' in generationOptions)) {
      generationOptions.return_full_text = false;
    }
    const result = await textGeneration(prompt, {
      ...generationOptions,
    });
    return extractGeneratedText(result);
  }

  async releaseTextGeneration(modelId: string) {
    const pipelinePromise = this.textGenerationPipelines.get(modelId);
    this.textGenerationPipelines.delete(modelId);
    const pipeline = await pipelinePromise;
    await pipeline?.dispose?.();
  }

  async removeTextGeneration(modelId: string) {
    const pipelinePromise = this.textGenerationPipelines.get(modelId);
    this.textGenerationPipelines.delete(modelId);
    const pipeline = await pipelinePromise?.catch(() => undefined);
    await pipeline?.dispose?.();
  }

  async preloadLanguageDetection(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    await this.loadLanguageDetectionPipeline(modelId, options);
  }

  async detectLanguage(modelId: string, text: string) {
    const detector = await this.loadLanguageDetectionPipeline(modelId);
    const result = await detector(text, {
      topk: 1,
      truncation: true,
    });
    return extractDetectedLanguage(result);
  }

  async preloadImageEditing(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }) {
    await this.loadBackgroundModel(options);
    options?.onProgress?.(100);
  }

  async prepareBackgroundRemoval(
    objectUrl: string,
    options?: { onProgress?: (progress: number) => void },
  ) {
    await this.encodeAsset(objectUrl, options?.onProgress);
    options?.onProgress?.(100);
  }

  async segmentBackgroundRemoval(
    objectUrl: string,
    points: SegmentationPoint[],
  ): Promise<BackgroundSegmentationResult> {
    const positivePoints = points.filter((point) => point.positive);
    const promptPoints = positivePoints.length > 0 ? positivePoints : points;
    const segmentations = await Promise.all(
      promptPoints.map((point) => this.segment(objectUrl, [point])),
    );
    if (segmentations.length === 0)
      throw new Error('At least one point is required for segmentation.');
    const firstSegmentation = segmentations[0];
    if (!firstSegmentation) throw new Error('At least one point is required for segmentation.');
    const subjectData = new Uint8Array(
      firstSegmentation.mask.width * firstSegmentation.mask.height,
    );
    let scoreTotal = 0;

    for (const segmentation of segmentations) {
      const bestMaskIndex = this.getBestMaskIndex(segmentation.scores);
      const maskCount = segmentation.scores.length;
      scoreTotal += segmentation.scores[bestMaskIndex] ?? 0;

      for (let pixelIndex = 0; pixelIndex < subjectData.length; pixelIndex += 1) {
        if (segmentation.mask.data[maskCount * pixelIndex + bestMaskIndex] === 1) {
          subjectData[pixelIndex] = 1;
        }
      }
    }

    return {
      imageInput: firstSegmentation.imageInput,
      subjectMask: {
        data: subjectData,
        width: firstSegmentation.mask.width,
        height: firstSegmentation.mask.height,
        score: scoreTotal / segmentations.length,
      },
    };
  }

  async removeImageEditing() {
    const backgroundModelPromise = this.backgroundModelPromise;
    this.backgroundModelPromise = null;
    this.encodedAssets.clear();

    const backgroundModel = await backgroundModelPromise?.catch(() => undefined);
    await backgroundModel?.model.dispose?.();
  }

  private loadTextGenerationPipeline(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    const existingPipeline = this.textGenerationPipelines.get(modelId);
    if (existingPipeline) return existingPipeline;

    const pipelinePromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
      env.useBrowserCache = true;
      env.cacheKey = imageGenerationModel.TRANSFORMERS_CACHE_KEY;
      return (await pipeline('text-generation', modelId, {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: progress.createTransformersProgressCallback(options?.onProgress),
      })) as unknown as TextGenerationPipeline;
    });
    this.textGenerationPipelines.set(modelId, pipelinePromise);
    return pipelinePromise;
  }

  private loadLanguageDetectionPipeline(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    const existingPipeline = this.languageDetectionPipelines.get(modelId);
    if (existingPipeline) return existingPipeline;

    const pipelinePromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
      env.useBrowserCache = true;
      env.cacheKey = imageGenerationModel.TRANSFORMERS_CACHE_KEY;
      return await pipeline('text-classification', modelId, {
        device: 'webgpu',
        progress_callback: progress.createTransformersProgressCallback(options?.onProgress),
      });
    });
    this.languageDetectionPipelines.set(modelId, pipelinePromise);
    return pipelinePromise;
  }

  private async segment(
    objectUrl: string,
    points: SegmentationPoint[],
  ): Promise<SegmentationResult> {
    const { model, processor, RawImage, Tensor } = await this.loadBackgroundModel();
    const encodedAsset = await this.encodeAsset(objectUrl);
    const reshaped = encodedAsset.imageProcessed.reshaped_input_sizes[0]!;
    const inputPoints = new Tensor(
      'float32',
      points.flatMap((point) => [point.x * reshaped[1], point.y * reshaped[0]]),
      [1, 1, points.length, 2],
    );
    const inputLabels = new Tensor(
      'int64',
      points.map((point) => (point.positive ? 1n : 0n)),
      [1, 1, points.length],
    );
    const { pred_masks: predMasks, iou_scores: iouScores } = await model({
      ...encodedAsset.imageEmbeddings,
      input_points: inputPoints,
      input_labels: inputLabels,
    });
    const masks = await processor.post_process_masks(
      predMasks,
      encodedAsset.imageProcessed.original_sizes,
      encodedAsset.imageProcessed.reshaped_input_sizes,
    );
    const mask = RawImage.fromTensor(masks[0]?.[0]);
    return {
      ...encodedAsset,
      mask,
      scores: Array.from(iouScores.data),
    };
  }

  private async encodeAsset(objectUrl: string, onProgress?: (progress: number) => void) {
    const cached = this.encodedAssets.get(objectUrl);
    if (cached) {
      void cached.then(
        () => {
          onProgress?.(100);
        },
        () => undefined,
      );
      return cached;
    }

    const encoded = this.createEncodedAsset(objectUrl, onProgress);
    this.encodedAssets.set(objectUrl, encoded);
    return encoded;
  }

  private async createEncodedAsset(
    objectUrl: string,
    onProgress?: (progress: number) => void,
  ): Promise<EncodedAsset> {
    onProgress?.(8);
    const { model, processor, RawImage } = await this.loadBackgroundModel();
    onProgress?.(28);
    const imageInput = await RawImage.fromURL(objectUrl);
    onProgress?.(45);
    const imageProcessed = await processor(imageInput);
    onProgress?.(68);
    const imageEmbeddings = await model.get_image_embeddings(imageProcessed);
    onProgress?.(100);
    return { imageInput, imageProcessed, imageEmbeddings };
  }

  private async loadBackgroundModel(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }) {
    this.backgroundModelPromise ??= this.createBackgroundModel(options);
    return this.backgroundModelPromise;
  }

  private async createBackgroundModel(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }) {
    const { AutoProcessor, RawImage, SamModel, Tensor, env } =
      await import('@huggingface/transformers');
    const progressCallback = progress.createTransformersProgressCallback(options?.onProgress);

    env.useBrowserCache = true;
    env.cacheKey = imageGenerationModel.TRANSFORMERS_CACHE_KEY;

    const [model, processor] = await Promise.all([
      SamModel.from_pretrained(IMAGE_EDITING_TRANSFORMERS_MODEL_ID, {
        dtype: 'fp16',
        device: 'webgpu',
        progress_callback: progressCallback,
      }),
      AutoProcessor.from_pretrained(IMAGE_EDITING_TRANSFORMERS_MODEL_ID, {
        progress_callback: progressCallback,
      }),
    ]);

    return {
      model: model as unknown as SamRuntimeModel,
      processor: processor as unknown as SamRuntimeProcessor,
      RawImage: RawImage as unknown as SamRawImageReader,
      Tensor: Tensor as unknown as SamTensorConstructor,
    };
  }

  private getBestMaskIndex(scores: number[]) {
    return scores.reduce(
      (bestIndex, score, index) => (score > scores[bestIndex]! ? index : bestIndex),
      0,
    );
  }
}

export const transformersOperations = {
  extractGeneratedText,
  extractDetectedLanguage,
  DirectTransformersOperations,
};
