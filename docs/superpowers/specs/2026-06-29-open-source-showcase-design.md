# Open Source Showcase Design

Date: 2026-06-29

## Goal

Prepare LocalStudio.dev for a public open-source launch with a polished repository surface, practical contributor onboarding, reliable GitHub Actions checks, and a GitHub Pages demo path.

This is a showcase-ready launch package, not a full maintainer automation suite. It should make the project credible and easy to try without adding governance or release process before the repo has public contributor pressure.

## Decisions

- Product and public documentation name: LocalStudio.dev.
- License: MIT.
- Demo hosting: GitHub Pages from this repository.
- Launch level: project showcase.
- Excluded from this pass: code of conduct, security policy, release automation, changelog automation, package publishing, and dependency scanning.

## Repository Surface

Add the core open-source files that visitors and contributors expect:

- `LICENSE` with standard MIT terms.
- `CONTRIBUTING.md` with setup, scripts, testing expectations, branch and PR guidance, and caveats for browser-only Web AI features.
- `.github/ISSUE_TEMPLATE/bug_report.yml` for reproducible bug reports.
- `.github/ISSUE_TEMPLATE/feature_request.yml` for scoped feature proposals.
- `.github/pull_request_template.md` with checklist items for linting, type checking, tests, build, screenshots when UI changes, and documentation updates.
- `docs/ARCHITECTURE.md` with the current monorepo structure and runtime boundaries.

Do not add `CODE_OF_CONDUCT.md` or `SECURITY.md` in this launch package.

## README Design

Rewrite the README as the public entry point for LocalStudio.dev.

The README should be intentionally short and high-impact. It should optimize for a "WOW" first impression, then quickly route readers to setup, architecture, and contribution details. Avoid turning the README into full project documentation.

The README should include:

- Title and concise product description.
- Badges for CI, Pages deploy, MIT license, Node 26, React, Vite, and TypeScript.
- Live demo link for GitHub Pages.
- Hero demo using an existing asset from `apps/landing/public`, preferably `powered-webau.gif` or `prompt-to-slide.gif`.
- Functionality gallery that shows all existing GIF demos from `apps/landing/public` to exemplify the product capabilities.
- Supporting screenshots where useful for static feature previews, using the existing PNG files.
- Short linked model/API credits for the Hugging Face models, Hugging Face WebML resources, and Chrome built-in AI APIs used by the app.
- Quick start for local development.
- Browser support notes for experimental Web AI features.
- Workspace layout.
- Scripts table for development, linting, type checking, tests, and build.
- Architecture summary linking to `docs/ARCHITECTURE.md`.
- Roadmap section for future work.
- Contributing and license sections.

Media should use relative paths so it renders on GitHub. Existing GIF and PNG assets should be reused; no new screenshots or recordings are required unless implementation finds a broken or missing asset.

The README should distinguish between:

- Product capabilities: browser-only Canva-style slides and image editing with Web AI.
- Contributor workflow: install dependencies, run the apps, run checks, and open PRs.

The functionality gallery should include every existing GIF demo:

- `apps/landing/public/powered-webau.gif`
- `apps/landing/public/prompt-to-slide.gif`
- `apps/landing/public/prompt-to-image.gif`
- `apps/landing/public/translate.gif`
- `apps/landing/public/edit-images.gif`
- `apps/landing/public/fs-history.gif`

Keep captions short and benefit-oriented. Longer explanations belong in `docs/ARCHITECTURE.md` or `CONTRIBUTING.md`.

## Model And API Links

The README should include a compact credits/references section linking to the external browser AI pieces currently used by the app:

- Gemma WebGPU model: `https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX`
- TranslateGemma WebGPU model: `https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX`
- Language detection model: `https://huggingface.co/onnx-community/xlm-roberta-base-language-detection-ONNX`
- Image editing segmentation model: `https://huggingface.co/Xenova/slimsam-77-uniform`
- Bonsai image generation model: `https://huggingface.co/prism-ml/bonsai-image-ternary-4B-mlx-2bit`
- Bonsai WebGPU reference Space: `https://huggingface.co/spaces/webml-community/bonsai-image-webgpu`
- Hugging Face WebML community: `https://huggingface.co/webml-community`
- Chrome Prompt API docs: `https://developer.chrome.com/docs/ai/prompt-api`
- Chrome Translator API docs: `https://developer.chrome.com/docs/ai/translator-api`
- Chrome Language Detector API docs: `https://developer.chrome.com/docs/ai/language-detection`

Keep this section short. It should credit the underlying ecosystem and help technical readers inspect the local AI stack without interrupting the visual README flow.

## Architecture Documentation

`docs/ARCHITECTURE.md` should document the system at a level useful for contributors:

- Root npm workspace.
- `apps/landing`: marketing and public demo entry served at `/`.
- `apps/editor`: Web AI editor served at `/editor/`.
- `packages/brand`: shared LocalStudio.dev tokens and CSS.
- Browser-only AI service boundary in `apps/editor/src/services`.
- Local-first persistence through the File System Access API.
- Build output expectation: landing at `/`, editor at `/editor/`.
- Known platform constraints: Chrome-only or experimental browser APIs for some AI workflows, WebGPU availability, and user-granted local folder access.

This document should stay descriptive. It should not propose major refactors or introduce new architecture.

## GitHub Actions

Add `.github/workflows/ci.yml`.

The CI workflow should run on pull requests and pushes to `main`.

Use Node 26 because the project already targets modern Node package metadata and depends on current Vite, TypeScript, and `@types/node` 26 versions.

The CI job should run:

1. Checkout.
2. Setup Node with npm cache.
3. `npm ci`.
4. `npm run lint`.
5. `npm run typecheck`.
6. `npm run test`.
7. `npm run build`.

Add `.github/workflows/pages.yml`.

The Pages workflow should run on pushes to `main` and manual dispatch. It should:

1. Checkout.
2. Setup Node with npm cache.
3. Install with `npm ci`.
4. Build with `npm run build`.
5. Upload the production artifact.
6. Deploy with the official GitHub Pages actions.

Implementation should verify whether the current Vite output works from GitHub project Pages. If the app assumes root hosting and project Pages uses a repository subpath, add a minimal configurable base path solution rather than hard-coding an unknown future repository name.

## Verification

Before implementation is considered complete, run the same local checks used by CI:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Also verify the local npm script starts the connected app stack:

- `npm run dev` starts landing, editor, and joystick together.
- Local routes load as expected: landing at `/`, editor at `/editor/`, and joystick at `/joystick/` when using the development or production build flow.

Inspect the production build output enough to confirm:

- The landing app is available at the site root.
- The editor remains available under `/editor/`.
- README media paths point to files that exist in the repository.
- GitHub workflow badge names match the workflow filenames.

## Implementation Notes

Keep changes focused on repository readiness. Avoid app feature work, visual redesign, dependency upgrades, and unrelated refactoring.

If implementation uncovers a genuine deploy blocker, prefer the smallest configuration change needed to make GitHub Pages work and document the reason in the implementation plan.
