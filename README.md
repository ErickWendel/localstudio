# LocalStudio.ai

Browser-only Canva-style slides and image editor MVP, with a product landing page in the same repo.

## Workspace Layout

- `apps/landing` is the lightweight marketing site served at `/`.
- `apps/editor` is the heavy Web AI editor served at `/editor/`.
- `packages/brand` contains shared LocalStudio.ai colors, fonts, and design tokens.

## Current MVP Snapshot

- LocalStudio.ai landing page presenting the Web AI positioning and linking into the editor.
- LocalStudio.ai editor shell with layered slide canvas, click-toggle left tool rail, Text/Layout/Design/AI Tools/Assets panels, right-side Pages panel, local image import, text editing, layer controls, copy/paste, undo/redo, zoom, presentation fullscreen, and PNG export path.
- Local-first persistence through the browser File System Access API, with project metadata and assets saved to a user-selected folder.
- Browser-local AI flows for background removal via Segment Anything-style WebGPU segmentation, Chrome Built-in AI translation, Chrome Prompt API prompt-to-slides, and Bonsai Image WebGPU create-image generation.
- AI Tools owns local model/API setup, translation target selection, Prompt API readiness, and image-generation size/steps/seed configuration.
- Latest target checks: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Scripts

- `npm run dev` starts the landing page dev server.
- `npm run dev:editor` starts the editor dev server.
- `npm run dev:landing` starts the landing page dev server explicitly.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript strict checks across the brand package and both apps.
- `npm run test` runs unit tests for the landing page and editor.
- `npm run build` creates one deployable `dist/` folder with the landing page at `/` and editor at `/editor/`.

## Design Source

Approved Stitch handoff lives at:

`docs/design/stitch/ew-canvas-ai/README.md`

The canonical header comes from `screens/ai-tools.html`, with the export button treatment from `screens/design.html`.
