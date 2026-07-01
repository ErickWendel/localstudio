# Bonsai Image WebGPU Runtime

This vendored runtime is derived from the static bundle in the Hugging Face Space:

- `webml-community/bonsai-image-webgpu`
- Source bundle inspected at commit `e0c8de64e86a2085c22de476b52ec3939ff7e85c`
- Runtime model family: `prism-ml/bonsai-image-ternary-4B-mlx-2bit`

The upstream Space publishes a static demo bundle, not a package. LocalStudio vendors a runtime-only
slice of that bundle:

- the Vite modulepreload prologue is removed;
- the Three.js/demo page code is removed;
- only the internal `BonsaiImagePipeline` export remains.

LocalStudio.dev calls only the runtime surface:

```ts
BonsaiImagePipeline.from_pretrained(modelId, options)
pipeline.generate(options)
```

LocalStudio imports this module through `BrowserBonsaiImageRuntime`. Production image generation uses
`WorkerBackedBonsaiImageRuntime` by default so model loading and generation run off the editor shell
thread. Direct runtime fallback is reserved for tests and browsers that cannot construct module
workers.

This vendored artifact should be replaced with an official package or source-built runtime-only
module if the Bonsai runtime is published later.
