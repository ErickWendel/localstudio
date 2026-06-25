# LocalStudio.ai MVP Design

Date: 2026-06-24

## Summary

Build a browser-only MVP for a Canva-like slides and image editor. The working context is a slide/page-based editor: users create a project with multiple pages, place layered elements on each page, and export pages as images or the full project as a PDF deck.

The MVP is local-only. Project data lives in user-selected files/folders on disk through the browser File System Access API, while lightweight app preferences and provider readiness metadata may live in browser storage. There are no accounts, backend services, cloud sync, collaboration, or server-side AI in the MVP.

The initial AI feature set is balanced:

- Translate design text.
- Generate a color palette from a text prompt.
- Remove image backgrounds.
- Smart Grab for object-aware image editing.
- Magic Eraser with user-guided browser segmentation.

Chrome Built-in AI is the primary provider for language/design tasks. Hugging Face / Transformers.js browser models are used only when required for vision capabilities Chrome does not currently provide.

## Implementation Status at 2026-06-25 Update

The current `main` branch contains a working browser-only editor shell aligned with the approved Stitch/EW Academy direction. The implementation is still an MVP scaffold, but the core local editor loop is now usable enough for iteration.

Ready now:

- React/Vite/TypeScript app scaffold with strict typing, ESLint, Prettier, Husky pre-commit hooks, Vitest, Testing Library, and Playwright configuration.
- Approved dark LocalStudio.ai shell with top toolbar, left slide rail, central Konva canvas, prompt bar, and right panel tabs ordered as `Layout`, `Design`, and `AI Tools`.
- Local document model for projects, pages, assets, and layered text/image/shape elements.
- Immutable command classes for alignment, z-order, frame transforms, text updates, layer reorder, visibility, locking, deletion, and adding imported image elements.
- File System Access API project persistence scaffold. When supported, clicking the persistence icon or `File > Save Local` asks for a project folder, writes `project.json`, writes `config/localstudio.json`, and creates `assets/`, `config/`, and `cache/` folders. `File > Import Project` opens an existing project folder by reading its `project.json`.
- File-backed image asset persistence. Imported/generated data URL image assets are written into the project `assets/` folder, while `project.json` stores metadata and relative filenames instead of large inline image payloads.
- Autosave is active after persistence is enabled. Document mutations write the updated project back to the active project folder, while startup restore skips the hydration save so it does not overwrite the last good project.
- LocalStudio.ai remembers File System Access directory handles in browser structured storage. It keeps both a global recent project handle and project-name keyed handles, so restarted tabs with `?project=<name>` reopen their own project context instead of whichever project was opened most recently.
- `File > New Project` opens a blank project in a new tab via `?newProject=1`, consumes that query once, and removes stale project context so refreshes do not recreate blank projects.
- Canvas element selection, drag, resize, rotate, text double-click editing, and locked-element transform prevention.
- Layout panel selection sync: clicking a layer selects the matching canvas element.
- Layout panel layer controls: drag/drop layer order, hide/show, lock/unlock, and delete.
- Left rail local image import from disk. Imported images are inserted as topmost layers and selected immediately.
- Image elements render actual image assets. The seeded selected image uses the provided remote image URL and preserves its natural `516 x 387` dimensions instead of scaling up. Imported images preserve natural size and only scale down when larger than the page.
- AI Tools panel includes local model readiness/download states and local Chrome AI tool cards. The image editing model is consolidated as a shared segmentation dependency for background removal, Smart Grab, and Magic Eraser.
- Click-guided background removal is wired through the shared Segment Anything WebGPU-style image editing provider. The flow blocks until the model is ready, prepares the selected image, previews the selected subject in blue, supports right-click positive refinement points, applies removal on left click, and tightens the selected image bounds after extraction.
- Chrome Built-in AI translation is wired behind `TranslatorService` for selected text, current slide, and full deck scopes. The visible entry points are the selected-text floating toolbar action, the slide translate icon above the canvas, and `Edit > Translate Deck`. The first translation attempt redirects to AI Tools until the user chooses a default target language in `Translate Design > Translate to`.
- The AI Tools translation card uses a hard-coded Chrome Translator-supported target-language list sorted by language name, with flags shown at the end of each option. Changing the target language prepares the detected source/target pair, shows download progress, and reuses the prepared translator for subsequent text/slide/deck translation.
- Translated text now gets a first-pass fit treatment: single-line source text has accidental translated whitespace collapsed, the text box expands around its original center first, and height grows if needed before any future manual overflow flow is introduced.
- Export service shell and mocked AI provider seams exist for later real provider work.
- Unit/component tests are under `tests/unit`; browser specs are under `tests/e2e`.
- Latest verified local checks: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.

Known limitations in the current implementation:

- Chrome Built-in AI translation is wired with target-language selection, pair preparation progress, busy guards, basic error notices, detector fallback normalization, and first-pass fit-to-frame behavior. It still needs richer manual overflow controls, richer recovery guidance, broader browser/device verification, and Playwright coverage.
- The first real Transformers.js / Hugging Face vision provider is wired for click-guided background removal through Segment Anything WebGPU, but it still needs broader browser/device verification and production hardening.
- Palette generation, Smart Grab, and Magic Eraser are still mocked or incomplete workflows.
- Export supports the current-page PNG path, but production-quality browser verification and export UX polish remain. PDF export is still missing.
- Layer drag/drop works through the app UI and tested callbacks, but should receive more Playwright coverage after interaction stabilizes.
- Page background is displayed as a static layer row and is not yet a fully editable/selectable element.
- Undo/redo, duplicate, delete shortcuts, zoom controls, basic alignment, and z-order actions are implemented. Multi-select, richer multi-element alignment, and real property editing remain incomplete.
- Some historical or remote seeded assets may still hydrate with runtime object/data URLs, but newly imported/generated file-backed assets are stored through the project `assets/` folder.

Next implementation priorities:

1. Finish translation UX hardening: manual overflow controls, richer recovery guidance, browser language availability verification on target Chrome builds, and Playwright coverage.
2. Finish remaining non-AI editor fundamentals: real Design-tab property fields, page background editability, multi-select, and multi-element alignment.
3. Harden remaining storage edges: generated preview/mask cache files, stale asset cleanup, and stronger save/import error recovery.
4. Complete export: polish current-page PNG export and add all-page PDF from the actual Konva stage at configured page dimensions. JPEG is deferred unless explicitly reintroduced.
5. Add Playwright coverage for layer reorder, hide/show, lock/unlock, delete, local image import, filesystem save, text editing, translation flows, and first-run setup.
6. Wire Chrome Built-in AI prompt-to-palette provider.
7. Build Smart Grab and Magic Eraser on top of the shared Segment Anything WebGPU image editing provider.

## Goals

- Provide a usable layered slide/image editor that runs entirely in the browser.
- Support local project persistence through browser-mediated disk storage with the File System Access API.
- Support PNG export for the current page first, then PDF export for a deck. JPEG is deferred unless explicitly reintroduced.
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
- Export the current page as PNG.
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
- Infrastructure: File System Access API project storage, lightweight browser metadata storage, asset blob storage, export utilities, and browser capability detection.

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
- `SmartGrabService`
- `MagicEraserService`

Concrete providers:

- `ChromeTranslatorService`
- `ChromePaletteService`
- `TransformersImageSegmentationService`
- `TransformersBackgroundRemovalService`
- `TransformersSmartGrabService`
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

The user can translate text at three scopes: selected text, current slide, or the full deck.

Behavior:

- Detect text elements and source language before translating each text value.
- Show the detected current language in the top toolbar near the user/profile area after startup language detection completes.
- When the user clicks any translation action for the first time without a target language selected, switch to the AI Tools tab and highlight `Translate Design`.
- `Translate Design` includes a `Translate to:` dropdown listing the Chrome Translator API supported language codes with readable names and flags. The selected target becomes the default for selected text, current slide, and full deck translation.
- Use Chrome Built-in AI translation and language detection APIs after setup confirms support.
- Preserve text element position, font size, color, alignment, and style metadata.
- Preserve the original visual placement. For single-line source text, collapse accidental translated line breaks/spaces, expand the text box around its original center first, and grow height if needed before considering future manual fit controls.
- Later, if translated text still overflows after auto-fit, flag the element and offer manual fit-to-box resizing.
- Apply changes through `TranslateTextCommand`.

Translation entry points:

- Selected text: when a text element is selected, the contextual/floating toolbar exposes a translate action. It translates only that selected text element.
- Current slide: each slide/page surface exposes a compact translate icon near the top of the slide controls. It translates every visible text element on the active slide.
- Full deck: `Edit > Translate Deck` translates text elements across all slides in the project automatically after the user chooses the default target language.

Translation result rules:

- Text, slide, and deck translation all use the same Chrome Built-in AI provider interface and command pipeline.
- Translation must preserve the document hierarchy: selected-text translation updates one element, slide translation updates elements on the active page only, and deck translation updates text elements on every page.
- The translator must run language detection before translation and use the detected source language when creating the browser translator. If detected source and target language match, the text is left unchanged.
- Language Detector output must be normalized to Chrome Translator-supported source codes before calling `Translator.availability()` or `Translator.create()`. Known detector aliases/fallbacks include `gl` and `ca` to `es`, `he` to `iw`, `nb`/`nn` to `no`, and Traditional Chinese region tags to `zh-Hant`.
- Chrome `Translator.availability()` states `available`, `downloadable`, and `downloading` are all valid translation paths. `downloadable` and `downloading` must continue into `Translator.create()` so Chrome can fetch or finish fetching the language pack for that source/target pair.
- Translated changes participate in undo/redo as atomic commands per requested scope.
- Locked or hidden text elements are skipped unless the user explicitly enables an advanced option later. The MVP default is to translate visible, unlocked text only.

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

- Use the WebML Community Segment Anything WebGPU example as the implementation reference because it demonstrates in-browser SAM segmentation with `Xenova/slimsam-77-uniform`, `SamModel`, `AutoProcessor`, WebGPU execution, positive/negative point prompts, mask preview, and cut-out generation.
- Clicking the floating toolbar `Remove Background` icon enters a background-selection mode instead of immediately changing the image.
- Show a Stitch-styled hint: `Click the main object to keep. Everything else will be removed.`
- While background-selection mode is active, highlight only the selected image layer and use a pointer cursor over that image so the user understands the next click is a segmentation prompt.
- Open the AI Tools tab and pulse the `Image Editing Models` download button when the shared segmentation model is not ready.
- Ask the user to click the image subject to segment. Background removal is not fully automatic in the first implementation.
- Convert the click into a normalized subject point relative to the selected image and pass that point to the segmentation provider.
- Generate a subject mask from the clicked point.
- Produce a transparent PNG asset where the selected subject remains opaque and the background becomes transparent.
- Let the user replace the original image layer or create a duplicate layer.
- Store the new asset blob locally and update the page through a command.

### Magic Eraser

The user selects an image element, marks the object or region to remove, previews the generated mask, and applies the erase.

MVP behavior:

- Use the shared Segment Anything WebGPU image segmentation provider because Chrome Built-in AI does not provide this MVP capability.
- Allow positive and negative point prompts on the selected image.
- Generate and preview a mask overlay before mutating the document.
- Let the user erase the selected mask area to transparency, producing a new transparent PNG asset.
- Let the user replace the original image layer or create a duplicate edited layer.
- Apply changes through `ApplyImageMaskCommand` or `ReplaceImageAssetCommand`.

MVP limitation:

- Magic Eraser does not perform content-aware background reconstruction. Removing pixels creates transparency. Canva-like object removal with inpainting/fill is a roadmap enhancement.

SAM3 Tracker WebGPU is not the preferred MVP reference. It is useful for future investigation because it uses newer SAM3 tracker models, but it is broader and heavier than the point-prompt segmentation needed for first-version Magic Eraser.

### Smart Grab

The user selects an image and grabs the main subject or a clicked object for image editing actions.

Behavior:

- Use the shared Segment Anything WebGPU image segmentation provider because Chrome Built-in AI does not provide this MVP capability.
- Let the user click the subject or object they want to grab.
- Generate a mask for the clicked object.
- Use the mask as the basis for future object-aware actions, such as subject extraction, object repositioning, and crop/reframe suggestions.
- Store derived mask/crop metadata on the image element or edited asset, depending on the action.

## First-Run AI Setup

The MVP includes a blocking first-run setup screen before the editor.

Purpose:

- Explain that the app runs AI locally in the browser.
- Ask the user to prepare required AI models/dependencies.
- Trigger provider-level model downloads or initialization after explicit user action.
- Check readiness before enabling the editor.

The setup flow checks:

- Chrome Built-in AI availability for translation and prompt-based palette generation.
- Chrome Built-in AI language detection and translation readiness before enabling selected-text, slide, or deck translation actions.
- Required Transformers.js image segmentation model availability for background removal, Smart Grab, and Magic Eraser.
- WebGPU/WebAssembly support needed by selected browser models.
- File System Access API availability and permission state for project data, assets, app config, and app-generated cache artifacts.
- Browser storage availability for lightweight app preferences, recent project handles, and model/provider readiness metadata.

First-run setup scope for the next implementation pass:

- Storage readiness is checked first because project persistence, asset files, and generated cache files are prerequisites for reliable local editing.
- Chrome Built-in AI readiness is checked next for language detection and translation. If Chrome reports translation unavailable or needs setup, translation controls remain disabled and the AI Tools panel explains the missing capability.
- Transformers.js image editing readiness remains available through the AI Tools panel. The image editing model can be downloaded on demand unless a future flow requires it at startup.
- The setup screen must not copy AI model weights into the project folder. It only coordinates browser/provider-managed readiness and local project folder readiness.

Caching policy:

- Do not build a custom model cache manager from scratch.
- Use Chrome's own model availability/download behavior for Chrome Built-in AI.
- Use Transformers.js browser caching, Web Cache API support, WASM caching, cache keys, or custom cache adapter support where appropriate. AI model weights and runtime caches may remain in browser/provider-managed storage.
- Store project-owned metadata, assets, app config, generated previews, generated masks, and other app-generated cache artifacts inside the user-selected project folder/package on disk.
- Store only lightweight app-level readiness metadata in browser storage, such as model name, version, capability status, last setup check, whether setup completed, and recent project handles.
- For Hugging Face / Transformers.js models that are not required during startup, show a download icon next to the model/tool name so the user can install that model on demand before running the feature.
- The top toolbar does not include a global "Prepare AI Models" action.
- The AI Tools panel includes a "Download Required Models" action that prepares required local models.
- The AI Tools panel lists one shared `Image Editing Models` dependency with the subtitle `Segmentation model for image editing.` This single Segment Anything model powers Background Remover, Smart Grab, and Magic Eraser.
- Each required model dependency shows independent readiness/progress state so future parallel downloads can be tracked separately.
- Optional/deferred models remain visible as downloadable capabilities inside the AI Tools panel.

Model and capability rows expose states:

- unavailable
- needs download
- downloading
- ready
- failed

If a required MVP capability is unavailable, show a clear blocking error with the missing requirement and target browser guidance.

## Persistence

Use the browser File System Access API for local project persistence.

The MVP project is saved as a user-selected folder/package on disk. This keeps large project data outside browser quota-managed storage and makes the project portable and inspectable by the user.

Project folder/package contents:

- `project.json`: canonical project document, pages, elements, asset references, project settings, and schema version.
- `assets/`: original imported assets and generated image assets, addressed by stable asset IDs.
- `config/`: project-local editor configuration, export settings, and non-secret setup metadata.
- `cache/`: app-generated thumbnails, previews, masks, derived crop data, and other reproducible project-local artifacts.

Browser storage remains allowed only for lightweight app state:

- Recent project handles or reopen metadata. Because File System Access handles cannot be serialized into `localStorage`, the app stores a lightweight `localStorage` marker and stores actual directory handles in browser-managed structured storage. Handles are stored for the global recent project and by project name so independent tabs can reopen their own context.
- User preferences that are not project-specific.
- Provider/model readiness metadata.
- Permission and setup timestamps.

AI model weights and provider runtime caches are not copied into project folders. Chrome Built-in AI and Transformers.js continue using browser/provider-managed caching for models.

The app should autosave document changes to the active project folder after the user grants access. Failed persistence must not corrupt the active in-memory document or the last good on-disk project state. Writes should use an atomic or staged strategy where practical, such as writing a temporary file and replacing the target after successful serialization. Current implementation verifies autosave after persistence is enabled by saving updated project metadata after an edit.

The persistence status icon is the primary save-to-disk entry point. When users click it while persistence is disabled, LocalStudio.ai requests a project folder and enables autosave only after the initial write succeeds. The File menu exposes the same save action as `Save Local` and exposes `Import Project` for selecting an existing project folder whose `project.json` should replace the current in-memory project. After a project folder is saved or imported, LocalStudio.ai remembers it locally and writes `?project=<project name>` into the current tab URL. On page restart, that tab first attempts to reopen the named project handle. If no project name is present, it can fall back to the global recent project handle. `File > New Project` opens a blank tab through `?newProject=1`, consumes the command once, and removes stale project query context.

If the File System Access API is unavailable or the user denies folder/file permissions, the MVP should show a blocking unsupported-browser or permission-required state instead of silently falling back to large IndexedDB project storage. Future non-Chrome fallbacks may use import/export project packages, but that is outside the MVP.

## Export

MVP exports:

- PNG for the current page.
- PDF for all pages in project order.

PNG export renders from the canvas stage at the page's configured dimensions.

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
- Persistence repository behavior with File System Access API mocks, including project folder creation/opening, autosave after edits, project-name keyed tab restore, staged writes, permission-denied states, and lightweight browser metadata storage.
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
- Smart Grab with mocked provider.
- Magic Eraser mask preview and apply flow with mocked provider.
- Export PNG and PDF flows.

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

For image editing segmentation, `webml-community/segment-anything-webgpu` is the preferred reference over `webml-community/SAM3-Tracker-WebGPU` for the MVP. It is simpler, directly focused on still-image segmentation, and already demonstrates the key interaction pattern needed by the editor: encode image, collect positive/negative points, decode mask, preview, and generate a transparent cutout. The shared model is `Xenova/slimsam-77-uniform`.

## References

- Chrome Built-in AI overview: https://developer.chrome.com/docs/ai/built-in
- Chrome Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- Chrome Translator API: https://developer.chrome.com/docs/ai/translator-api
- Transformers.js environment and cache settings: https://huggingface.co/docs/transformers.js/api/env
- Transformers.js custom model usage: https://huggingface.co/docs/transformers.js/custom_usage
- WebML Community Spaces: https://huggingface.co/webml-community/spaces
- Segment Anything WebGPU Space: https://huggingface.co/spaces/webml-community/segment-anything-webgpu
- SAM3 Tracker WebGPU Space: https://huggingface.co/spaces/webml-community/SAM3-Tracker-WebGPU
