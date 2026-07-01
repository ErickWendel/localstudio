# Bonsai Image Generation Status

Date: 2026-06-25
Last updated: 2026-07-01

## Goal

Let users generate browser-local images from the prompt bar when `Create image` mode is active. Generated images become normal editable image layers on the current slide.

## Implemented

- Prompt bar `+ > Create image` chip mode.
- Readiness gate: if image generation models are not ready, the app opens AI Tools and highlights `Image Generation Models`.
- AI Tools owns image generation settings:
  - common size presets;
  - steps;
  - optional seed;
  - hover/focus help text explaining steps and seed.
- Bonsai Image WebGPU runtime adapter is isolated in `src/services/bonsaiImageRuntime.ts`.
- Vendored runtime lives under `src/vendor` as a runtime-only slice of the upstream Space bundle, without the demo page or Three.js scene code.
- Production image generation and image model preload use `WorkerBackedBonsaiImageRuntime` by default.
- The worker protocol supports `preload`, `generate`, progress, result, and error messages, with a direct runtime fallback only for tests and environments that cannot construct module workers.
- Model progress handling includes byte-level progress when available plus conservative setup progress for long runtime phases.
- LocalStudio only depends on the runtime surface: `BonsaiImagePipeline.from_pretrained()` and `pipeline.generate()`.
- Generated PNGs are inserted into the active slide as selected image elements.
- Prompt input clears immediately after submission while generation continues.

## Current Provider

- Hugging Face Space reference: `webml-community/bonsai-image-webgpu`.
- Current model: `prism-ml/bonsai-image-ternary-4B-mlx-2bit`.

## Remaining Work

- Add cancellation.
- Add generation history.
- Add model/provider selection if binary/ternary or future image models are exposed.
- Add richer error recovery for unsupported browser/GPU, interrupted downloads, and runtime import failures.
- Replace the vendored runtime slice with an official source-built runtime-only Bonsai package if one becomes available.
- Verify behavior on target Chrome/WebGPU builds and memory-constrained devices.
- Reintroduce browser e2e coverage only through a future explicit plan after the flow stabilizes.

## Verification Target

For image generation changes, run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

Browser e2e is not part of the active toolchain.
