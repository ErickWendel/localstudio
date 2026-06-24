# Canva Web AI Clone MVP Design

Date: 2026-06-24

## Summary

Build a browser-only MVP for a Canva-like slides and image editor. The working context is a slide/page-based editor: users create a project with multiple pages, place layered elements on each page, and export pages as images or the full project as a PDF deck.

The MVP is local-only. Projects, assets, setup metadata, and user state live in the browser. There are no accounts, backend services, cloud sync, collaboration, or server-side AI in the MVP.

The initial AI feature set is balanced:

- Translate design text.
- Generate a color palette from a text prompt.
- Remove image backgrounds.
- Smart crop / auto-enquadramento.
- Magic Eraser with user-guided browser segmentation.

Chrome Built-in AI is the primary provider for language/design tasks. Hugging Face / Transformers.js browser models are used only when required for vision capabilities Chrome does not currently provide.

## Goals

- Provide a usable layered slide/image editor that runs entirely in the browser.
- Support local project persistence through IndexedDB.
- Support PNG/JPEG export per page and PDF export for a deck.
- Provide an explicit first-run AI setup flow for required local model dependencies.
- Keep the codebase maintainable through strict typing, command-driven state updates, dependency injection, class-based services, linting, hooks, and automated tests.
- Require layout approval from Google Stitch designs before coding the production UI.

## Non-Goals

- User accounts, billing, teams, collaboration, comments, sharing, or cloud storage.
- Server-side rendering, server-side AI inference, or hosted project APIs.
- Editable JSON import/export as a user-facing MVP feature.
- The MVP does not include Image Upscaler or CLIP semantic asset search.
- The MVP does not include content-aware inpainting/fill for Magic Eraser.
- The MVP does not include Non-Chrome AI provider fallbacks.
- CI containers or production deployment automation.

## Product Experience

The editor is a layered composition workspace. Each project contains pages. Each page behaves like a slide-sized design surface, but it can also be used to create image outputs such as social graphics or posters.

Users can:

- Add text, images, and basic shapes.
- Use a full-bleed image as a page background.
- Place multiple images side by side.
- Layer text, images, and shapes above or below each other.
- Select, move, resize, rotate, duplicate, delete, lock, and unlock elements.
- Align one element to page center, horizontal center, or vertical center.
- Align multiple selected elements by left, right, top, bottom, horizontal center, or vertical center.
- Change z-order with bring forward, send backward, bring to front, and send to back.
- Trigger context-aware AI actions from the selected element toolbar, including remove background for selected image layers and translate design for text/page content.
- Use a prompt input below the main canvas to request slide structure, text organization, or current-content layout changes through the browser Prompt API in a later implementation phase.
- The prompt input includes text submit and microphone controls so users can type or dictate prompts.
- Export the current page as PNG/JPEG.
- Export all pages as a PDF deck.

The MVP should feel like an editor first, not an AI demo. AI tools operate on selected elements and the existing layered document model.

## Design Approval Gate

The production UI layout will be designed in Google Stitch. Implementation must not begin until the Stitch layout is reviewed and approved.

The Stitch design must follow the EW Academy visual identity from https://ew.academy.

Brand direction:

- Overall appearance: dark, developer-focused, high-contrast, technical, and polished.
- Primary background: `#050D10`.
- Deep black surfaces: `#000000` and near-black panels such as `#040404`.
- Primary accent: EW neon green `#37FD76` / `#37FD77`.
- Green hover/glow accent: `#00FF22`.
- Muted text/support color: `#91999D`.
- Secondary neutrals: `#333333`, `#696969`, `#FFFFFF`.
- Optional course/category accent colors, used sparingly: red `#FF0000`, yellow `#FFEA00`, lime `#B7FF00`, cyan-blue `#00779A`.
- Typography: use `Orbitron` for logo-like labels, screen titles, buttons, major navigation, and AI/tool labels. Use `Open Sans` for body text, dense panels, property fields, status text, and readable editor UI copy.
- Shape language: mostly sharp or lightly rounded surfaces, with occasional angled/hexagonal button or panel cuts inspired by EW Academy's call-to-action buttons. Avoid soft, bubbly, generic SaaS styling.
- Effects: restrained neon-green focus rings, borders, and glow. Use glow as emphasis for primary actions and active AI states, not as a constant background decoration.
- Accessibility: preserve contrast and legibility. Orbitron should not be overused for long paragraphs or dense property panels.

The approved Stitch design should define:

- Main editor shell layout.
- Top toolbar.
- Left page/assets rail.
- Canvas/stage area.
- Right properties panel.
- AI setup screen.
- AI tool entry points and status states.
- Export flow.
- Layer ordering controls.
- Alignment controls.
- Per-model download controls for optional or deferred model dependencies.
- Current language indicator and language selection entry point.
- Prompt input below the main canvas for slide/page structure and content organization, including a microphone icon for audio prompting.

The implementation plan should treat the approved Stitch output as the visual source of truth. If implementation discovers an impossible or expensive interaction, the design must be revised and re-approved before coding that surface.

## Architecture

Use React, Vite, TypeScript, and Konva through React Konva for the canvas editor.

The app is organized into clear layers:

- UI components: React screens, panels, toolbars, dialogs, and canvas bindings.
- Application services: class-based services that coordinate editor actions, persistence, AI operations, setup, and export.
- Domain model: immutable project/page/element data structures and command objects.
- Provider adapters: concrete integrations for Chrome Built-in AI and Transformers.js.
- Infrastructure: IndexedDB repositories, asset blob storage, export utilities, and browser capability detection.

Stateful UI components and application services depend on service interfaces, not concrete providers. Simple presentational components may remain dependency-free. Application composition wires concrete service implementations at startup.

Core service interfaces:

- `ProjectRepository`
- `AssetRepository`
- `EditorCommandBus`
- `ExportService`
- `ModelSetupService`
- `TranslatorService`
- `PaletteService`
- `BackgroundRemovalService`
- `SmartCropService`
- `MagicEraserService`

Concrete providers:

- `ChromeTranslatorService`
- `ChromePaletteService`
- `TransformersBackgroundRemovalService`
- `TransformersSmartCropService`
- `TransformersMagicEraserService`

Future providers can be added behind the same interfaces without changing editor UI flows.

## Document Model

The document model is normalized and serializable internally.

Project:

- `id`
- `name`
- `pages`
- `assets`
- `createdAt`
- `updatedAt`

Page:

- `id`
- `name`
- `width`
- `height`
- `background`
- ordered `elementIds`

Element:

- `id`
- `type`: `text`, `image`, or `shape`
- `x`
- `y`
- `width`
- `height`
- `rotation`
- `locked`
- `opacity`
- type-specific properties

Image elements reference an asset ID and may include crop metadata. Text elements include content and style metadata. Shape elements include geometry and fill/stroke metadata.

Z-order is represented by the page's ordered `elementIds` list. Commands update that order immutably.

## Command Model

All editor mutations flow through command classes. Commands are atomic and produce immutable document updates.

Initial command examples:

- `AddElementCommand`
- `MoveElementCommand`
- `ResizeElementCommand`
- `RotateElementCommand`
- `DuplicateElementCommand`
- `DeleteElementCommand`
- `LockElementCommand`
- `SetZOrderCommand`
- `AlignElementCommand`
- `AlignSelectionCommand`
- `SetImageCropCommand`
- `TranslateTextCommand`
- `ApplyPaletteCommand`
- `ReplaceImageAssetCommand`
- `ApplyImageMaskCommand`

This structure supports undo/redo, unit testing, and predictable failure behavior.

## MVP AI Features

### Translate Design

The user can translate text on the current page or the full project.

Behavior:

- Detect text elements and source language where available.
- Show the detected current language in the top toolbar near the user/profile area after startup language detection completes.
- When the user clicks Translate Design, preselect the translation flow using the detected current language as context so the user starts by choosing or confirming the target language.
- Use Chrome Built-in AI translation and language detection APIs after setup confirms support.
- Preserve text element position, font size, color, alignment, and style metadata.
- If translated text overflows, flag the element and offer fit-to-box resizing.
- Apply changes through `TranslateTextCommand`.

### Text-to-Palette

The user enters a prompt such as `Verão na Itália` or `Tecnologia Cyberpunk`.

Behavior:

- Use Chrome Built-in AI Prompt API to generate strict JSON.
- Expected output: palette name and five valid hex colors.
- Validate generated JSON before applying it.
- Allow applying the palette to selected elements, the current page theme, or swatches.
- Apply changes through `ApplyPaletteCommand`.

### Background Remover

The user selects an image element and removes its background.

Behavior:

- Use a browser-side vision model through Transformers.js / Hugging Face because Chrome Built-in AI does not provide this MVP capability.
- Produce a transparent PNG asset.
- Let the user replace the original image layer or create a duplicate layer.
- Store the new asset blob locally and update the page through a command.

### Magic Eraser

The user selects an image element, marks the object or region to remove, previews the generated mask, and applies the erase.

MVP behavior:

- Use a browser-side segmentation model through Transformers.js / Hugging Face because Chrome Built-in AI does not provide this MVP capability.
- Prefer the WebML Community Segment Anything WebGPU example as the implementation reference because it demonstrates in-browser SAM-style segmentation with `Xenova/slimsam-77-uniform`, `SamModel`, `AutoProcessor`, WebGPU execution, positive/negative click prompts, mask preview, and cut-out generation.
- Allow positive and negative point prompts on the selected image.
- Generate and preview a mask overlay before mutating the document.
- Let the user erase the selected mask area to transparency, producing a new transparent PNG asset.
- Let the user replace the original image layer or create a duplicate edited layer.
- Apply changes through `ApplyImageMaskCommand` or `ReplaceImageAssetCommand`.

MVP limitation:

- Magic Eraser does not perform content-aware background reconstruction. Removing pixels creates transparency. Canva-like object removal with inpainting/fill is a roadmap enhancement.

SAM3 Tracker WebGPU is not the preferred MVP reference. It is useful for future investigation because it uses newer SAM3 tracker models, but it is broader and heavier than the point-prompt segmentation needed for first-version Magic Eraser.

### Smart Crop / Auto-Enquadramento

The user selects an image and a target frame/aspect ratio.

Behavior:

- Use browser-side object detection or segmentation through Transformers.js because Chrome Built-in AI does not provide this MVP capability.
- Identify the likely main subject.
- Suggest a crop box centered around the subject.
- Let the user accept or adjust the crop before applying.
- Store crop metadata on the image element.

## First-Run AI Setup

The MVP includes a blocking first-run setup screen before the editor.

Purpose:

- Explain that the app runs AI locally in the browser.
- Ask the user to prepare required AI models/dependencies.
- Trigger provider-level model downloads or initialization after explicit user action.
- Check readiness before enabling the editor.

The setup flow checks:

- Chrome Built-in AI availability for translation and prompt-based palette generation.
- Required Transformers.js model availability for background removal and smart crop.
- Required segmentation model availability for Magic Eraser.
- WebGPU/WebAssembly support needed by selected browser models.
- Browser storage availability for project data, assets, and model/provider caches.

Caching policy:

- Do not build a custom model cache manager from scratch.
- Use Chrome's own model availability/download behavior for Chrome Built-in AI.
- Use Transformers.js browser caching, Web Cache API support, WASM caching, cache keys, or custom cache adapter support where appropriate.
- Store only app-level readiness metadata in IndexedDB, such as model name, version, capability status, last setup check, and whether setup completed.
- For Hugging Face / Transformers.js models that are not required during startup, show a download icon next to the model/tool name so the user can install that model on demand before running the feature.
- The top toolbar does not include a global "Prepare AI Models" action.
- The AI Tools panel includes a "Download Required Models" action that downloads required local models in parallel.
- Each required model shows independent readiness/progress state so parallel downloads can be tracked separately.
- Optional/deferred models remain visible as downloadable capabilities inside the AI Tools panel.

Model and capability rows expose states:

- unavailable
- needs download
- downloading
- ready
- failed

If a required MVP capability is unavailable, show a clear blocking error with the missing requirement and target browser guidance.

## Persistence

Use IndexedDB for local persistence.

Store:

- Project documents.
- Asset metadata.
- Asset blobs.
- Setup readiness metadata.
- User preferences.

The app should autosave document changes. Failed persistence must not corrupt the active in-memory document. Large binary assets are stored separately from document metadata and referenced by ID.

## Export

MVP exports:

- PNG/JPEG for the current page.
- PDF for all pages in project order.

PNG/JPEG export renders from the canvas stage at the page's configured dimensions.

PDF export renders each page to an image and assembles those images into a browser-generated PDF. Export is local-only and downloads through the browser.

Editable JSON export/import is not part of the MVP user experience, even though the internal document model remains serializable.

## Error Handling

AI features must show explicit capability and runtime states. Feature buttons should be disabled or show setup-required status when dependencies are missing.

Long operations should show progress/status and support cancellation where feasible. AI operations must not silently mutate the document. If an AI operation fails, the document remains in its previous valid state.

Commands are atomic. A failed command does not partially update the project.

Export failures should show a user-readable reason and leave the project unchanged.

## Quality Standards

The codebase should follow:

- SOLID.
- KISS.
- Immutability for domain updates.
- Dependency injection through interfaces and application composition.
- Class-based services for testability.
- Small modules with clear responsibilities.
- Strict TypeScript.

Required tooling:

- TypeScript strict mode.
- ESLint.
- Prettier.
- Husky pre-commit hooks.
- Unit test runner.
- Playwright for browser testing.

Pre-commit hooks should run:

- lint
- typecheck
- unit tests

No CI container setup is required for the MVP.

## Testing Strategy

Unit tests:

- Command classes.
- Document update logic.
- Z-order and alignment rules.
- Palette JSON validation.
- Image mask application and transparent asset generation.
- Service interface behavior with mocked providers.
- Persistence repository behavior with fake IndexedDB or equivalent browser storage test utilities.
- Export orchestration with renderer mocks.

Playwright tests:

- First-run setup happy path with mocked AI providers.
- Create project/page.
- Add text and image.
- Move, resize, align, and layer elements.
- Use bring forward/send backward controls.
- Translate text with mocked provider.
- Generate and apply palette with mocked provider.
- Remove background with mocked provider.
- Smart crop with mocked provider.
- Magic Eraser mask preview and apply flow with mocked provider.
- Export PNG/JPEG and PDF flows.

AI provider tests should use mocks for normal application flow. Direct provider smoke tests may be added separately, but they should not make the main test suite depend on large model downloads.

## Browser Target

The MVP targets Chrome with Built-in AI support.

Non-Chrome browsers and alternative AI providers are roadmap items. The architecture should allow future fallbacks, but the MVP does not implement them.

## Roadmap After MVP

- Magic Eraser content-aware inpainting/fill upgrade.
- Image Upscaler / Super Resolution.
- CLIP semantic search for assets.
- Non-Chrome AI provider fallbacks.
- Better offline model management.
- Editable JSON import/export.
- Template library.
- Cloud sync.
- Accounts and collaboration.
- Presentation mode.

## Feasibility Notes

Chrome Built-in AI is appropriate for the MVP language/design features because Chrome provides browser APIs for prompt-based generation and translation. Browser availability and hardware/model readiness are checked during first-run setup.

Transformers.js is appropriate for browser-side vision features because it supports browser execution, WebGPU/WebAssembly paths, and provider-managed caching controls. The WebML Community Spaces provide useful implementation references for browser-native model loading, WebGPU execution, and interactive segmentation UX. The MVP should pick small, browser-suitable models and load them only during setup or first use.

WebGPU should be treated as a performance path, not an unconditional assumption. Selected vision models must be validated on target Chrome hardware before implementation starts.

For Magic Eraser, `webml-community/segment-anything-webgpu` is the preferred reference over `webml-community/SAM3-Tracker-WebGPU` for the MVP. It is simpler, directly focused on still-image segmentation, and already demonstrates the key interaction pattern needed by the editor: encode image, collect positive/negative points, decode mask, preview, and generate a transparent cutout.

## References

- Chrome Built-in AI overview: https://developer.chrome.com/docs/ai/built-in
- Chrome Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- Chrome Translator API: https://developer.chrome.com/docs/ai/translator-api
- Transformers.js environment and cache settings: https://huggingface.co/docs/transformers.js/api/env
- Transformers.js custom model usage: https://huggingface.co/docs/transformers.js/custom_usage
- WebML Community Spaces: https://huggingface.co/webml-community/spaces
- Segment Anything WebGPU Space: https://huggingface.co/spaces/webml-community/segment-anything-webgpu
- SAM3 Tracker WebGPU Space: https://huggingface.co/spaces/webml-community/SAM3-Tracker-WebGPU
