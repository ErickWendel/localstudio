# AI Provider Architecture Status

Date: 2026-06-26

## Goal

Prompt and translation features must work through interchangeable local providers. Chrome Built-in AI is preferred when compatible, but users can choose WebGPU Hugging Face providers for compatibility, experimentation, or model refresh.

## Provider Targets

LLM / prompt-to-slides:

- Chrome Built-in Prompt API.
- Gemma 4 WebGPU from `webml-community/Gemma-4-WebGPU`.

Translation:

- Chrome Built-in Translator and Language Detector APIs.
- TranslateGemma WebGPU from `webml-community/TranslateGemma-WebGPU`.

## Implemented

- Provider metadata model:
  - capability;
  - runtime;
  - compatibility;
  - readiness;
  - optional disabled reason;
  - optional downloadable model id.
- Persisted provider preferences:
  - `localstudio.ai.prompt-provider`;
  - `localstudio.ai.translation-provider`.
- Prompt provider abstraction behind `PromptService`.
- Translation provider abstraction behind `TranslatorService`.
- Chrome prompt/translation providers.
- Gemma prompt provider using the shared prompt builders and generated-slide validators.
- TranslateGemma provider using shared language alias normalization and translation flow.
- AI Tools provider cards:
  - `LLM Model`;
  - `Translate Design`;
  - image generation configuration.
- Removed obsolete headings/copy:
  - `Local Chrome AI`;
  - `Cached Browser Models`.
- LLM and translation backing model progress lives in the configuration cards, not duplicated as visible `needs download` rows.
- Chrome providers are disabled when browser APIs are unavailable or incompatible.
- WebGPU providers are disabled when WebGPU/runtime requirements are unavailable.
- Selecting a downloadable provider starts preparation automatically when it is not ready.
- Download icon appears when the selected external provider is missing/not ready.
- Remove icon appears when the selected external provider is cached/ready.
- Removing Gemma or TranslateGemma:
  - clears model readiness metadata;
  - deletes matching Transformers/browser cache artifacts when available;
  - disposes in-memory WebGPU text-generation pipeline sessions when available;
  - returns the model to `needs-download`;
  - keeps the same provider selected so users can refresh a model without switching providers.

## Remaining Work

- Add deeper provider registry/default-selection tests.
- Add more direct prompt provider tests for Gemma structured JSON behavior.
- Add more direct translation provider tests for TranslateGemma unsupported-pair recovery.
- Add browser verification for non-Chrome WebGPU paths.
- Reintroduce browser e2e coverage for provider switching and remove/redownload flows only through a future explicit plan.

## Verification Target

For provider architecture changes, run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

Browser e2e is not part of the active toolchain.
