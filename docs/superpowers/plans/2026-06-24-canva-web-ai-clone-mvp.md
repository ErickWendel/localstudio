# LocalStudio.ai MVP Plan Status

Date: 2026-06-24
Last updated: 2026-06-26

## Purpose

This file is the compact status record for the original MVP implementation plan. The detailed task-by-task scaffolding instructions were removed because they referenced old component names, old layout decisions, and completed implementation snippets.

Use the spec as the source of truth:

- `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`

## Completed Foundation

- React/Vite/TypeScript app scaffold.
- Strict lint/type/test setup with Husky pre-commit hooks.
- LocalStudio.ai black/green editor shell.
- Canva-style layout: top toolbar, click-toggle left tool rail, central vertical page workspace, right Pages panel, docked prompt bar, and footer controls.
- Normalized project/page/asset/element model.
- Immutable command-based editor updates.
- Konva canvas selection, drag, resize, rotate, text edit, z-order, lock, visibility, crop, flip, duplicate, delete, undo/redo, select all, shift multi-select, grouped movement, object copy/paste, and image paste/import.
- Text, Layout, Design, AI Tools, and Assets panels.
- File System Access persistence with project folders, file-backed assets, autosave, query-string project restore, and recent project handles.
- Current-page PNG export path.
- Provider-based AI service seams for prompt, translation, image generation, and image editing.
- Unit/component tests live under `tests/unit`.

## Completed AI Slices

- Translation through selected provider for selected text, current page, and deck.
- LLM provider selection between Chrome Built-in Prompt API and Gemma 4 WebGPU.
- Translation provider selection between Chrome Built-in Translator and TranslateGemma WebGPU.
- Download/progress/remove behavior for external models, including cache cleanup and selection preservation after model removal.
- Prompt-to-slide generation for the active page through structured JSON.
- Bonsai Image WebGPU create-image flow.
- Segment Anything-style click-guided background removal with blue preview and right-click refinement.

## Current Testing Direction

The active MVP verification path is:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Playwright/e2e has been removed from the active MVP toolchain. Reintroduce browser e2e only through a future explicit plan.

## Current Follow-Up Plans

- Storage, setup, and translation: `docs/superpowers/plans/2026-06-25-storage-setup-translation.md`
- Prompt-to-slide generation: `docs/superpowers/plans/2026-06-25-prompt-api-slide-generation.md`
- Bonsai image generation: `docs/superpowers/plans/2026-06-25-bonsai-image-generation.md`
- AI provider architecture: `docs/superpowers/plans/2026-06-26-ai-provider-architecture.md`
- Version history: `docs/superpowers/plans/2026-06-26-version-history.md`

## Remaining MVP Work

- Stale asset cleanup and stronger filesystem error recovery.
- Richer multi-element alignment/distribution.
- Translation overflow controls and better failed-pair/download recovery.
- Multi-slide prompt-to-deck generation and schema repair/retry UX.
- Smart Grab and Magic Eraser on the shared segmentation provider.
- Image generation cancellation, history, provider/model selection, and production verification.
- Polished PNG export and all-page PDF export.
- Missing unit/component coverage for stabilized editor, storage, translation, and AI flows.
