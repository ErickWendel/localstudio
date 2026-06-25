interface BonsaiRuntimeProgress {
  component?: string;
  fromCache?: boolean;
  loaded?: number;
  phase?: string;
  total?: number;
}

interface BonsaiPipelineResult {
  toBlob?: () => Blob | Promise<Blob>;
}

interface BonsaiPipeline {
  generate(options: {
    callback_on_step_end?: (_pipeline: unknown, step: number) => void;
    guidance_scale: 1;
    height: number;
    num_inference_steps: number;
    prompt: string;
    seed?: number;
    width: number;
  }): Promise<BonsaiPipelineResult | Blob>;
}

export const BonsaiImagePipeline: {
  from_pretrained(
    modelId: string,
    options?: {
      cacheName?: string;
      onProgress?: (progress: BonsaiRuntimeProgress) => void;
      signal?: AbortSignal;
    },
  ): Promise<BonsaiPipeline>;
};
