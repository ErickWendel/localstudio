# LocalStudio.ai MVP Spec

Date: 2026-06-24
Last updated: 2026-06-26

## Summary

LocalStudio.ai is a local-first browser slide and image editor inspired by Canva. Users create a project with multiple pages, place layered text/images/shapes on each page, edit those layers directly on a Konva canvas, and use local/browser AI tools for translation, prompt-to-slide generation, image generation, and image editing.

The MVP has no accounts, backend, cloud sync, collaboration, billing, or server-side AI. Project files live in a user-selected folder through the browser File System Access API. Browser AI model weights stay in provider-managed browser caches.

## Current Product Shape

The editor uses a Canva-style layout with LocalStudio.ai black/green visual identity:

- Top toolbar: product name, File/Edit/View/Help, editable deck title, persistence/history, undo/redo, language indicator, and export.
- Left rail: click-toggle menus for Layout, Text, Design, AI Tools, and Assets.
- Center workspace: vertically scrolling pages; the active page is the page closest to the viewport center.
- Right panel: Pages navigation with thumbnails, reorder, duplicate, hide/show, delete, rename, add page, and translate page.
- Footer: notes, zoom out/in/reset, pages toggle/count, and slide presentation fullscreen.
- Prompt bar: always visible near the bottom of the workspace. Default mode creates/organizes slide content; `+ > Create image` switches to image generation mode.

The app should feel like an editor first. AI actions operate on selected elements, pages, or the deck; they should not feel like separate demos bolted onto the canvas.

## Implemented

Core editor:

- React, Vite, TypeScript, strict linting, Prettier, Husky, Vitest, and Testing Library.
- Normalized project/page/asset/element document model.
- Immutable command-based updates for common editor operations.
- Konva-backed canvas selection, drag, resize, rotate, text editing, crop mode, flip, lock prevention, z-order, duplicate, delete, undo/redo, select all, shift multi-select, grouped movement, and copy/cut/paste.
- Text tab presets for LocalStudio.ai title, subtitle, and body styles.
- Image import from disk and clipboard, preserving natural size and scaling down only when needed.
- Image toolbar with BG Remover, Flip, and Crop.
- Dotted neon movement guides while dragging.
- Slide presentation fullscreen that hides editor-only chrome.
- Current-page PNG export path.

Storage:

- File System Access project folders with `project.json`, `assets/`, `config/localstudio.json`, and `cache/`.
- Imported, pasted, generated, and background-removed images are stored as files under `assets/` when persistence is enabled.
- Autosave after document changes when persistence is enabled.
- Project restore by query string and recent project handle.
- `File > New Project` opens a blank project in a new tab and consumes the query flag.
- Local version-history storage in `history/` with snapshot preview/restore groundwork.

AI:

- Provider-neutral AI Tools panel. Configuration appears first, followed by visible downloadable model rows for image editing and image generation.
- LLM provider selection: Chrome Built-in Prompt API or Gemma 4 WebGPU.
- Translation provider selection: Chrome Built-in Translator or TranslateGemma WebGPU.
- Chrome providers are preferred when compatible; external WebGPU providers can be selected manually or used for non-Chrome-compatible flows.
- Download/progress state for Gemma, TranslateGemma, Segment Anything-style image editing, and Bonsai image generation.
- Removing a cached model deletes relevant Transformers/browser cache artifacts, disposes in-memory WebGPU text-generation pipelines when available, marks the model downloadable again, and keeps the selected provider unchanged so users can refresh a model without switching back to Chrome.
- Translation for selected text, current page, and full deck through the selected provider. Target language is chosen in AI Tools, language options are hard-coded to supported browser codes, sorted by language name, and flags appear at the end of option labels.
- Translation includes source language detection, detector alias normalization, pair preparation progress, repeated-click guards, basic notices, and first-pass text-box fitting.
- Prompt-to-slide generation from the default prompt bar mode using structured JSON tasks and per-element structured JSON payloads. Generated slide updates apply progressively through immutable document commands.
- Placeholder image support through a bundled asset and support for user-provided `https://` image URLs.
- Image generation through Bonsai Image WebGPU when `Create image` mode is active. Size presets, steps, and optional seed are configured in AI Tools. Generated images become normal image layers.
- Click-guided background removal through the shared image editing provider. Users right-click to add positive refinement areas and left-click to apply removal. Previewed selection appears in blue, and the resulting image bounds tighten around the extracted subject.

## Architecture

Use React, TypeScript, Vite, and React Konva.

Code is split into:

- `src/domain`: pure serializable model and immutable commands. No React, DOM, Konva, or provider imports.
- `src/services`: service interfaces plus concrete browser/provider adapters.
- `src/ui`: React panels, canvas bindings, toolbars, and view-model orchestration.
- `src/vendor`: browser AI runtimes that need to be lazily imported by Vite.
- `tests/unit`: unit and component coverage.

Important service boundaries:

- `ProjectRepository`
- `ExportService`
- `ModelSetupService`
- `PromptService`
- `TranslatorService`
- `ImageGenerationService`
- `BackgroundRemovalService`

UI should depend on service interfaces and injected app services, not concrete Chrome, Hugging Face, or filesystem implementations.

## Storage Contract

When persistence is enabled, a project folder should contain:

```text
project.json
assets/
cache/
config/
  localstudio.json
history/
  manifest.json
  versions/
```

Rules:

- `project.json` stores document metadata and relative asset filenames, not large inline image payloads.
- `assets/` stores imported, pasted, generated, and transformed image files.
- `cache/` is reserved for durable generated previews/masks that should survive reloads.
- `history/` stores local version snapshots.
- AI model weights stay in browser/provider caches, not in the project folder.
- The app must not fall back to large localStorage/IndexedDB project storage.

## AI Provider Rules

- Chrome Built-in APIs are preferred when compatible and ready.
- WebGPU Hugging Face providers remain browser-local alternatives, not cloud fallbacks.
- Provider choice is a browser preference, not part of `ProjectDocument` for the MVP.
- Selecting a downloadable external provider should prepare/download it automatically when needed.
- If a cached external model is removed, the selected provider must remain selected and show the download action again.
- Progress bars should be monotonic and hide when ready.
- Chrome-owned downloads are represented in configuration cards, not as downloadable model rows.

## Testing Direction

The active MVP verification path is:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Playwright/e2e is not part of the active toolchain. Reintroduce browser e2e coverage only through a future explicit plan.

## Remaining Work

Storage:

- Stale asset cleanup that accounts for active project references and version-history snapshots.
- Durable `cache/` use for generated masks/previews.
- Better permission-denied, missing-asset, invalid-project, and partial-write recovery UI.

Editor:

- Richer multi-element alignment and distribution.
- Higher-fidelity page thumbnails.
- Deeper Design-tab property coverage.
- More robust canvas interaction polish on mobile and small viewports.

AI:

- Translation overflow controls: fit text, expand box, accept wrap, or reset layout.
- Better failed-download/unsupported-pair recovery guidance.
- Multi-slide prompt-to-deck generation.
- Prompt schema repair/retry UX.
- Smart Grab and Magic Eraser on the shared segmentation provider.
- Image generation cancellation, generation history, provider/model selection, and deeper browser/device verification.
- Palette generation folded into the LLM design-generation flow.

Export:

- Polish current-page PNG export from the actual Konva stage.
- Add all-page PDF export.
- JPEG remains deferred unless explicitly reintroduced.

Testing:

- Add missing unit/component coverage for provider edge cases, storage recovery, text editing, image editing, translation, and prompt generation.
- Keep unit/component tests under `tests/unit`.

## Non-Goals

- Accounts, teams, collaboration, comments, cloud storage, or hosted project APIs.
- Server-side AI inference.
- CI container work.
- Image upscaling and CLIP semantic search in the MVP.
- Magic Eraser inpainting/content-aware fill in the MVP.
