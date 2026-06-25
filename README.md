# LocalStudio.ai

Browser-only Canva-style slides and image editor MVP.

## Current MVP Snapshot

- LocalStudio.ai editor shell with layered slide canvas, Layout/Design/AI Tools panels, local image import, text editing, layer controls, copy/paste, undo/redo, zoom, and PNG export path.
- Local-first persistence through the browser File System Access API, with project metadata and assets saved to a user-selected folder.
- Browser-local AI flows for background removal via Segment Anything-style WebGPU segmentation, Chrome Built-in AI translation, Chrome Prompt API prompt-to-slides, and Bonsai Image WebGPU create-image generation.
- AI Tools owns local model/API setup, translation target selection, Prompt API readiness, and image-generation size/steps/seed configuration.
- Latest verified checks: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript strict checks.
- `npm run test` runs unit tests.
- `npm run e2e` runs Playwright browser tests.
- `npm run build` creates a production build.

## Design Source

Approved Stitch handoff lives at:

`docs/design/stitch/ew-canvas-ai/README.md`

The canonical header comes from `screens/ai-tools.html`, with the export button treatment from `screens/design.html`.
