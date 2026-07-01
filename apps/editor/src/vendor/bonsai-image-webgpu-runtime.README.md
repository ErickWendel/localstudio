# Bonsai Image WebGPU Runtime

This vendored runtime is derived from the static bundle in the Hugging Face Space:

- `webml-community/bonsai-image-webgpu`
- Source bundle inspected at commit `e0c8de64e86a2085c22de476b52ec3939ff7e85c`
- Runtime model family: `prism-ml/bonsai-image-ternary-4B-mlx-2bit`

The original bundle was changed to prevent the demo UI startup call and export the internal
`BonsaiImagePipeline` class so LocalStudio.dev can call only the runtime surface:

```ts
BonsaiImagePipeline.from_pretrained(modelId, options)
pipeline.generate(options)
```

LocalStudio imports this module through `BrowserBonsaiImageRuntime`, and production image generation
uses `WorkerBackedBonsaiImageRuntime` by default so runtime parsing, model loading, and generation
stay outside the editor shell thread.

This vendored artifact should be replaced with an official package or source-built runtime-only
module if the Bonsai runtime is published later.
