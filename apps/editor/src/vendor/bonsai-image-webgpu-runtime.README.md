# Bonsai Image WebGPU Runtime

This vendored runtime is derived from the static bundle in the Hugging Face Space:

- `webml-community/bonsai-image-webgpu`
- Source bundle inspected at commit `e0c8de64e86a2085c22de476b52ec3939ff7e85c`
- Runtime model family: `prism-ml/bonsai-image-ternary-4B-mlx-2bit`

The original bundle was changed only to prevent the demo UI startup call and export the internal
`BonsaiImagePipeline` class plus demo cleanup hooks so LocalStudio.dev can call:

```ts
BonsaiImagePipeline.from_pretrained(modelId, options)
pipeline.generate(options)
```

The cleanup hooks are invoked immediately after import because the upstream demo bundle can still
create Three.js/canvas side effects when evaluated.

This is intentionally isolated behind `BrowserBonsaiImageRuntime` so it can be replaced with an
official package or source module if the Bonsai runtime is published later.
