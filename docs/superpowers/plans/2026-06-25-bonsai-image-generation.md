# Bonsai Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Keep this file updated with checkbox progress.

**Goal:** Add browser-local text-to-image generation to LocalStudio.ai. When the user selects `Create image` in the prompt bar, the app should require the Bonsai Image WebGPU model to be prepared from AI Tools, then generate a PNG and insert it into the current slide as a normal image layer.

**User Flow:**

1. User clicks `+` in the prompt bar.
2. User chooses `Create image`.
3. User types an image prompt and submits.
4. If the Bonsai model is not ready, the app switches to `AI Tools`, highlights `Image Generation Models`, and shows copy telling the user to download it first.
5. User downloads the model with the same model-row progress pattern used by image editing models.
6. User submits the `Create image` prompt again.
7. The app shows generation progress, disables duplicate submits, creates a PNG asset, and inserts it into the active slide.

**Source Context:** The referenced Hugging Face Space is `webml-community/bonsai-image-webgpu`. Its metadata points at `prism-ml/bonsai-image-ternary-4B-mlx-2bit` and `prism-ml/bonsai-image-binary-4B-mlx-1bit`. The Space bundle loads a pipeline with model progress for `text_encoder`, `transformer`, and `vae`, caches model chunks in IndexedDB, and generates with `prompt`, `height`, `width`, `guidance_scale: 1`, `num_inference_steps`, `seed`, and step callbacks.

**Implementation Choice:** Start with the ternary Bonsai model. Defer binary/ternary model selection, cancellation, generation history, and advanced controls.

---

## Architecture

Add one adapter seam and keep editor code simple:

- `ModelSetupService`: owns readiness/download state for `Image Generation Models`.
- `ImageGenerationService`: owns text-to-image generation and returns a LocalStudio.ai `Asset`.
- `BonsaiImageRuntime`: narrow injected adapter for the actual Bonsai WebGPU runtime.
- `PromptBar`: stays responsible for `Create image` mode and submit UI.
- `useEditorViewModel`: gates model readiness, redirects to AI Tools, calls generation, and inserts the generated image through immutable commands.

Create shared constants in a separate file so model setup and generation do not import each other:

```ts
// src/services/imageGenerationModels.ts
export const IMAGE_GENERATION_MODEL_ID = 'image-generation-models';
export const IMAGE_GENERATION_TRANSFORMERS_MODEL_ID = 'prism-ml/bonsai-image-ternary-4B-mlx-2bit';
export const IMAGE_GENERATION_READY_KEY = 'ew-canvas-ai.model.image-generation-models.ready';
export const DEFAULT_IMAGE_GENERATION_SIZE = 512;
export const DEFAULT_IMAGE_GENERATION_STEPS = 4;
```

Add service contracts:

```ts
export interface ImageGenerationOptions {
  height?: number;
  seed?: number;
  steps?: number;
  width?: number;
  onProgress?: (state: { label: string; progress: number }) => void;
}

export interface ImageGenerationService {
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<Asset>;
}
```

Returned generated assets must use the existing asset model:

```ts
{
  id: createId('asset-generated-image'),
  type: 'image',
  name: `${safePromptName}.png`,
  mimeType: 'image/png',
  objectUrl: blobUrl,
}
```

Do not add a new domain element type. Generated images are normal `image` elements.

---

## Task 1: Add Image Generation Model State

**Files:**

- Create: `src/services/imageGenerationModels.ts`
- Modify: `src/services/modelSetupService.ts`
- Test: `tests/unit/services/modelSetupService.test.ts`

- [x] Add `IMAGE_GENERATION_MODEL_ID`, `IMAGE_GENERATION_TRANSFORMERS_MODEL_ID`, `IMAGE_GENERATION_READY_KEY`, `DEFAULT_IMAGE_GENERATION_SIZE`, and `DEFAULT_IMAGE_GENERATION_STEPS`.
- [x] Add `ImageGenerationModelLoader` with `loadImageGenerationModel(): Promise<void>`.
- [x] Add `TransformersImageGenerationModelLoader` that delegates to the Bonsai runtime preload adapter. Keep it behind the interface so the UI never imports runtime-specific code.
- [x] Add an optional model state:

```ts
{
  id: IMAGE_GENERATION_MODEL_ID,
  label: 'Image Generation Models',
  description: 'Bonsai Image WebGPU text-to-image model.',
  provider: 'transformers',
  status: 'needs-download',
  progress: 0,
  required: false,
}
```

- [x] Hydrate readiness from `IMAGE_GENERATION_READY_KEY`.
- [x] On download, call `imageGenerationModelLoader.loadImageGenerationModel()`, update progress, mark ready, and persist the ready key.
- [x] On failure, clear the ready key and surface the failure state.
- [x] Update `InMemoryModelSetupService` so tests can mark the model ready.
- [x] Add tests that verify the model row exists, downloads independently, and hydrates ready state from storage.

Verification:

```bash
npm run test -- --run tests/unit/services/modelSetupService.test.ts
```

Commit:

```bash
git add src/services/imageGenerationModels.ts src/services/modelSetupService.ts tests/unit/services/modelSetupService.test.ts
git commit -m "Add image generation model setup state"
```

---

## Task 2: Add Bonsai Image Generation Service

**Files:**

- Create: `src/services/browserImageGenerationService.ts`
- Modify: `src/services/interfaces.ts`
- Modify: `src/services/inMemoryAiServices.ts`
- Modify: `src/app/composition.ts`
- Test: `tests/unit/services/browserImageGenerationService.test.ts`
- Test: `tests/unit/app/composition.test.ts`

- [x] Add `ImageGenerationService` and `ImageGenerationOptions` to `src/services/interfaces.ts`.
- [x] Implement `BrowserImageGenerationService` with injected dependencies:

```ts
interface BonsaiImageRuntime {
  preload(modelId: string): Promise<void>;
  generate(options: {
    modelId: string;
    prompt: string;
    height: number;
    width: number;
    steps: number;
    seed?: number;
    onStep?: (step: number, totalSteps: number) => void;
  }): Promise<Blob>;
}
```

- [x] Implement `BrowserBonsaiImageRuntime` in the same file or a small `src/services/bonsaiImageRuntime.ts` file. This is the only place allowed to know the Bonsai/Hugging Face runtime details.
- [x] First try the direct browser runtime path exposed by the Bonsai Space pattern. If the public package entry is not available, keep the adapter isolated and throw a clear setup error from the runtime only:

```ts
throw new Error('Bonsai Image WebGPU runtime is unavailable in this browser build.');
```

- [x] Do not let that runtime-specific error leak into editor code paths except as user-facing notice text.
- [x] `generateImage()` trims the prompt, rejects empty prompts, defaults to `512x512` and `4` steps, emits progress callbacks, converts the resulting `Blob` to `URL.createObjectURL(blob)`, and returns an `Asset`.
- [x] Add `MockImageGenerationService` to `src/services/inMemoryAiServices.ts` returning a deterministic 1x1 PNG data URL asset for tests.
- [x] Wire `BrowserImageGenerationService` in `src/app/composition.ts`.
- [x] Add tests that verify:
  - prompt is passed to the runtime;
  - default width/height/steps are used;
  - progress callbacks map to percentages;
  - returned asset is PNG-shaped and named from the prompt;
  - empty prompt rejects without calling the runtime.

Verification:

```bash
npm run test -- --run tests/unit/services/browserImageGenerationService.test.ts tests/unit/app/composition.test.ts
```

Commit:

```bash
git add src/services/interfaces.ts src/services/browserImageGenerationService.ts src/services/inMemoryAiServices.ts src/app/composition.ts tests/unit/services/browserImageGenerationService.test.ts tests/unit/app/composition.test.ts
git commit -m "Add browser image generation service"
```

---

## Task 3: Wire Create Image Prompt Flow

**Files:**

- Modify: `src/ui/editor/useEditorViewModel.ts`
- Modify: `src/ui/editor/PromptBar.tsx`
- Modify: `src/ui/editor/EditorShell.tsx`
- Test: `tests/unit/ui/editor/aiFlows.test.tsx`

- [x] Add view-model state:
  - `createImageNotice`
  - `createImageStatus`
  - `isGeneratingImage`
  - `attentionModelId` support for `IMAGE_GENERATION_MODEL_ID`
- [x] Add `generateImageFromPrompt(prompt: string)`.
- [x] If prompt is empty, do nothing.
- [x] If another image generation is running, do nothing.
- [x] If image generation model is not ready:
  - switch to `ai-tools`;
  - set `attentionModelId` to `IMAGE_GENERATION_MODEL_ID`;
  - show `Download image generation models before creating images.`;
  - do not call `imageGenerationService.generateImage()`.
- [x] If ready:
  - clear prior notice;
  - set busy state immediately;
  - call `imageGenerationService.generateImage(prompt, { onProgress })`;
  - insert the returned asset into the active slide through the existing immutable command path;
  - select the inserted image element;
  - clear busy/progress state in `finally`.
- [x] Fit inserted generated image inside the slide using the same placement helper used by imported/pasted images. Default visual size should not exceed the slide bounds.
- [x] Update `PromptBar` so `Create image` mode uses:
  - accessible label `Create image prompt`;
  - submit busy label `Generating image`;
  - disabled submit while generating;
  - visible status text while progress is available.
- [x] Update `EditorShell` props.
- [x] Add tests for:
  - redirect/highlight when unavailable;
  - no duplicate submit while generating;
  - successful generation inserts a new image layer;
  - generated image is selected after insertion.

Verification:

```bash
npm run test -- --run tests/unit/ui/editor/aiFlows.test.tsx
```

Commit:

```bash
git add src/ui/editor/useEditorViewModel.ts src/ui/editor/PromptBar.tsx src/ui/editor/EditorShell.tsx tests/unit/ui/editor/aiFlows.test.tsx
git commit -m "Wire create image prompt flow"
```

---

## Task 4: Update AI Tools UI and Specs

**Files:**

- Modify: `src/ui/editor/AiToolsPanel.tsx`
- Modify: `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`
- Modify: `docs/superpowers/plans/2026-06-25-storage-setup-translation.md`
- Test: `tests/unit/ui/editor/aiFlows.test.tsx`

- [x] Ensure `AiToolsPanel` renders the generic model row for `Image Generation Models`.
- [x] Ensure the row receives the same attention/highlight treatment as image editing models.
- [x] Disable the download button when the model state is `ready`.
- [x] Keep `Prompt API` under `Local Chrome AI`.
- [x] Keep `Image Generation Models` under cached browser models.
- [x] Remove any stale copy implying this is image editing or Prompt API.
- [x] Update the MVP spec:
  - create image now has a browser-local Bonsai provider;
  - model setup is required before first use;
  - generated PNG is inserted into the current slide;
  - model selection/history/cancelation remain future work.
- [x] Update the storage/translation roadmap with the completed create-image integration after implementation.
- [x] Add UI tests for the AI Tools row copy and disabled-ready download state.

Verification:

```bash
npm run test -- --run tests/unit/ui/editor/aiFlows.test.tsx
```

Commit:

```bash
git add src/ui/editor/AiToolsPanel.tsx tests/unit/ui/editor/aiFlows.test.tsx docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md docs/superpowers/plans/2026-06-25-storage-setup-translation.md
git commit -m "Update create image AI tools docs"
```

---

## Task 5: Final Verification

- [ ] Run non-Playwright verification:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- [ ] Manual smoke test with local dev server:

```bash
npm run dev
```

Manual checks:

- Open the editor.
- Click `+`.
- Choose `Create image`.
- Type `An icy Bonsai tree, in a rainy forest with snowy mountains in the background, photo realistic`.
- Submit before downloading models.
- Expected: app switches to `AI Tools`, highlights `Image Generation Models`, and explains that the model must be downloaded.
- Download `Image Generation Models`.
- Submit the prompt again.
- Expected: generation status appears, duplicate submit is blocked, and a selected generated image layer appears in the current slide.

- [ ] Commit final fixes only if verification required changes:

```bash
git add <changed-files>
git commit -m "Polish create image generation flow"
```

---

## Deferred Work

- Binary/ternary Bonsai model selector.
- Generation cancellation.
- Image generation history/gallery.
- Advanced controls for size, seed, steps, guidance, and aspect ratio.
- Production browser/device performance checks.
- Playwright coverage.
- Rich error recovery for Hugging Face access/token failures if the public model path ever requires it.

## Self-Review

- The feature stays local-first: model assets are cached in the browser and generated images become local slide assets.
- UI gating mirrors the existing AI Tools setup pattern.
- Runtime-specific Bonsai code is isolated behind `BonsaiImageRuntime`.
- The editor only depends on `ImageGenerationService`.
- Generated images use existing immutable document update paths.
- No new domain element type is introduced.
