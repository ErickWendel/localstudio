# AI Provider Architecture Implementation Plan

> **For agentic workers:** Keep this plan updated with checkbox progress. Implement spec-first, update the MVP spec as behavior changes, and skip Playwright/e2e unless the user explicitly asks for it.

**Goal:** Refactor Prompt API and Translate API into provider-based services so LocalStudio.ai can use Chrome Built-in AI when available and browser-local WebGPU Hugging Face models when Chrome APIs are unavailable or manually deselected.

**Architecture:** Add provider adapters behind the existing editor-facing prompt and translation flows. Chrome-specific API details stay inside Chrome providers, Hugging Face/WebGPU runtime details stay inside WebGPU providers, and `useEditorViewModel` continues to orchestrate high-level editor behavior through service interfaces.

**Provider targets:**

- LLM / prompt-to-slides:
  - Chrome Built-in Prompt API.
  - Gemma 4 WebGPU from `webml-community/Gemma-4-WebGPU`.
- Translation:
  - Chrome Built-in Translator and Language Detector APIs.
  - TranslateGemma WebGPU from `webml-community/TranslateGemma-WebGPU`.

**Verification:** Run `npm run lint`, `npm run typecheck`, and `npm run test`. Do not run Playwright/e2e for this pass.

---

## Current Status

- [x] Architecture plan saved.
- [x] MVP spec updated with provider-abstraction direction.
- [x] First provider implementation slice added on `main`: provider orchestrators, Gemma/TranslateGemma model rows, AI Tools provider configuration, provider-aware first-run setup, and unit coverage. Playwright/e2e intentionally skipped.

## Implementation Checklist

### Task 1: Provider Metadata and Selection Model

- [x] Add shared provider metadata types for AI capabilities:
  - capability: `prompt`, `translation`, `image-generation`, or `image-editing`.
  - runtime: `chrome-built-in` or `webgpu-huggingface`.
  - compatibility: `compatible`, `incompatible`, or `unknown`.
  - readiness: `unavailable`, `needs-download`, `downloading`, `ready`, or `failed`.
  - optional disabled reason and downloadable model id.
- [x] Add persisted provider preference keys:
  - `localstudio.ai.prompt-provider`
  - `localstudio.ai.translation-provider`
- [x] Default selection rules:
  - Use persisted provider if compatible.
  - Else use Chrome Built-in provider when compatible.
  - Else auto-select compatible Gemma/TranslateGemma WebGPU provider.
  - Else leave provider unready and show a clear AI Tools notice.
- [x] Keep provider selection outside `ProjectDocument`; it is a user/browser preference for this pass.

### Task 2: Prompt Provider Abstraction

- [x] Introduce a narrow `PromptProvider` interface behind `PromptService`.
- [x] Keep the current `generateSlideTasksFromPrompt()` and `generateSlideElementFromTask()` editor-facing methods stable.
- [x] Move current `ChromePromptService` behavior into a Chrome prompt provider adapter.
- [x] Add Gemma 4 WebGPU prompt provider adapter:
  - loads/prepares the Gemma WebGPU runtime through the model setup flow.
  - reuses `src/services/prompts/` prompt builders.
  - requests strict JSON.
  - parses through existing generated-slide validators.
- [x] Rename user-facing Prompt API readiness copy to LLM/model-neutral copy where the UI no longer specifically means Chrome.

### Task 3: Translation Provider Abstraction

- [x] Introduce a narrow `TranslationProvider` interface behind `TranslatorService`.
- [x] Keep current translation call sites stable:
  - language detection before translation.
  - selected text, current slide, and deck scopes.
  - busy guard against repeated clicks.
  - prepared source/target pair progress.
- [x] Move current `ChromeTranslatorService` behavior into a Chrome translation provider adapter.
- [x] Add TranslateGemma WebGPU provider adapter:
  - loads/prepares the TranslateGemma runtime through model setup.
  - supports the hard-coded language list already used by AI Tools when the model supports the target pair.
  - reports unsupported language pairs as recoverable UI notices.
- [x] Keep existing detector alias normalization shared so cases like `gl -> es` remain consistent across providers.

### Task 4: Unified Downloadable Model Registry

- [x] Extend `ModelSetupService` into the single downloadable model registry for browser-local models.
- [x] Add internal downloadable model states:
  - `gemma-4-webgpu-llm`: Gemma 4 WebGPU prompt-to-slides model.
  - `translategemma-webgpu`: TranslateGemma WebGPU translation model.
  - existing `image-editing-models`.
  - existing `image-generation-models`.
- [x] Keep Chrome Built-in APIs out of the downloadable model list because Chrome owns those downloads.
- [x] Reuse the existing model state shape and progress handling.
- [x] Selecting a downloadable provider should automatically begin preparation/download if the model is not ready.
- [x] LLM and translation backing model progress is shown in the Configuration cards, not duplicated as visible `needs-download` rows in the Models list.

### Task 5: AI Tools Redesign for Provider Choice

- [x] Remove visible section copy/headings:
  - `Local Chrome AI`
  - `Cached Browser Models`
- [x] Reorganize AI Tools into:
  - `Configuration`: provider and feature settings.
  - `Models`: unified downloadable model list.
- [x] Configuration section includes:
  - `LLM Model` dropdown with Chrome Built-in Prompt API and Gemma 4 WebGPU.
  - `Translate Design` target language dropdown.
  - `Translation Model` dropdown with Chrome Built-in Translator and TranslateGemma WebGPU.
  - existing image-generation size, steps, and seed controls.
- [x] Incompatible providers stay visible but disabled with a concise reason.
- [x] Downloadable provider selection starts model download/preparation automatically and highlights the matching model row.
- [x] Existing image editing and image generation flows continue using the same visible model rows and readiness behavior.

### Task 6: First-Run and Compatibility Messaging

- [x] Update first-run setup copy so it no longer implies Chrome is the only AI route.
- [x] File System Access readiness remains a storage requirement.
- [x] AI readiness becomes provider-aware:
  - Chrome APIs are enabled only when browser APIs exist and report usable availability.
  - WebGPU providers are enabled only when `navigator.gpu` and runtime import checks pass.
- [x] Non-Chrome users should see Gemma/TranslateGemma as the default compatible path when WebGPU is available.
- [x] If no local AI provider is compatible, keep AI actions disabled and show target-browser/device guidance.

### Task 7: Tests

- [ ] Add provider registry/default-selection tests.
- [ ] Add prompt provider tests:
  - Chrome provider still uses structured output constraints.
  - Gemma provider strict JSON output is parsed through existing validators.
  - prompt bar redirects/highlights AI Tools when the selected provider is not ready.
- [ ] Add translation provider tests:
  - Chrome provider preserves detect/prepare/translate behavior.
  - TranslateGemma provider readiness and unsupported-pair errors surface as notices.
  - selected text, slide, and deck translation still use the selected provider.
- [x] Add AI Tools tests:
  - old headings are removed.
  - Configuration appears before Models.
  - incompatible Chrome APIs are disabled outside supported browsers.
  - choosing Gemma/TranslateGemma starts model preparation.
- [ ] Run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`

## Assumptions

- Chrome Built-in APIs remain the preferred default when compatible.
- Gemma/TranslateGemma are browser-local WebGPU providers, not server fallbacks.
- Provider choices are user/browser preferences and do not need to be written into the project folder yet.
- The existing prompt JSON schemas, prompt files, and translation text-fitting behavior remain the app contract.
- Playwright/e2e is intentionally skipped for this implementation pass.
