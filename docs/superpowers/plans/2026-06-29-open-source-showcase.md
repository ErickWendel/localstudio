# Open Source Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert LocalStudio.ai into a showcase-ready public open-source repository with concise WOW-focused documentation, GitHub Actions, GitHub Pages deployment, MIT licensing, contribution templates, and local verification for landing and editor apps.

**Architecture:** Keep the app architecture unchanged. Add repository-level documentation and GitHub metadata, then make the Vite build configurable for GitHub Pages without hard-coding a future repository name. Reuse existing landing media and source-defined model IDs instead of generating new assets.

**Tech Stack:** npm workspaces, Vite, React, TypeScript, Vitest, ESLint, GitHub Actions, GitHub Pages.

---

## File Structure

- Create `LICENSE`: Standard MIT license for LocalStudio.ai.
- Create `CONTRIBUTING.md`: Contributor quick start, scripts, local app verification, PR guidance, and browser AI caveats.
- Create `docs/ARCHITECTURE.md`: Short contributor-facing architecture reference.
- Create `.github/workflows/ci.yml`: Pull request and `main` branch quality gate.
- Create `.github/workflows/pages.yml`: GitHub Pages deployment.
- Create `.github/ISSUE_TEMPLATE/bug_report.yml`: Structured bug reports.
- Create `.github/ISSUE_TEMPLATE/feature_request.yml`: Structured feature requests.
- Create `.github/pull_request_template.md`: PR checklist.
- Modify `README.md`: Short showcase README with badges, live demo, all GIF demos, quick start, model/API links, and contribution links.
- Modify `apps/landing/vite.config.ts`: Add configurable base path for project Pages while preserving root local development.
- Modify `apps/editor/vite.config.ts`: Derive editor base path from the same configurable site base.
- Verify `package.json` scripts as-is: local scripts already exist; only change them if verification proves routing is broken.

---

### Task 1: Add Configurable GitHub Pages Base Path

**Files:**
- Modify: `apps/landing/vite.config.ts`
- Modify: `apps/editor/vite.config.ts`

- [ ] **Step 1: Update landing Vite config**

Replace `apps/landing/vite.config.ts` with:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';

export default defineConfig({
  base: siteBase,
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: '../../dist',
  },
  test: {
    environment: 'jsdom',
    exclude: ['../../.worktrees/**', '../../dist/**', 'node_modules/**'],
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: './tests/setup/testUtils.tsx',
  },
});
```

- [ ] **Step 2: Update editor Vite config**

In `apps/editor/vite.config.ts`, add this helper near the imports:

```ts
const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';
const editorBase = new URL('editor/', `https://localstudio.invalid${siteBase}`).pathname;
```

Then change the exported config from:

```ts
base: '/editor/',
```

to:

```ts
base: editorBase,
```

- [ ] **Step 3: Verify the default build path remains unchanged**

Run:

```bash
npm run build
```

Expected: PASS. `dist/index.html` should reference root-relative landing assets, and `dist/editor/index.html` should reference `/editor/` assets.

- [ ] **Step 4: Verify a project Pages path is supported**

Run:

```bash
LOCALSTUDIO_BASE_PATH=/canva-webai-clone/ npm run build
```

Expected: PASS. `dist/index.html` should reference `/canva-webai-clone/` assets, and `dist/editor/index.html` should reference `/canva-webai-clone/editor/` assets.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/vite.config.ts apps/editor/vite.config.ts
git commit -m "Support configurable Pages base path"
```

---

### Task 2: Add GitHub Actions Workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    name: Lint, typecheck, test, and build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Create Pages workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    name: Build site
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          LOCALSTUDIO_BASE_PATH: /${{ github.event.repository.name }}/

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    name: Deploy site
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Check workflow syntax visually**

Run:

```bash
sed -n '1,220p' .github/workflows/ci.yml
sed -n '1,260p' .github/workflows/pages.yml
```

Expected: Both workflows have valid YAML indentation and use Node 26.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/pages.yml
git commit -m "Add CI and Pages workflows"
```

---

### Task 3: Add Open Source Community Metadata

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Create MIT license**

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 Erick Wendel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create contribution guide**

Create `CONTRIBUTING.md`:

```md
# Contributing

Thanks for helping improve LocalStudio.ai.

## Local Setup

```bash
npm ci
npm run dev
```

The default dev script opens the landing app. Use the focused scripts when you need one app:

```bash
npm run dev:landing
npm run dev:editor
```

## Quality Checks

Run the same checks CI runs before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Browser Notes

LocalStudio.ai uses browser-local AI features. Some paths need Chrome experimental APIs, WebGPU, browser-managed model caches, and permission to write project files through the File System Access API.

When changing AI flows, document which browser and device you tested. When changing UI, include a screenshot or short recording in the pull request.

## Pull Requests

Keep PRs focused. Describe the user-visible change, list the checks you ran, and call out browser-specific behavior.

Do not commit generated `dist/`, `coverage/`, `playwright-report/`, or `test-results/` output.
```

- [ ] **Step 3: Create bug report template**

Create `.github/ISSUE_TEMPLATE/bug_report.yml`:

```yaml
name: Bug report
description: Report something that is broken or behaving unexpectedly.
title: "[Bug]: "
labels: ["bug"]
body:
  - type: textarea
    id: summary
    attributes:
      label: What happened?
      description: Describe the issue and what you expected instead.
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
      description: List the smallest set of steps that trigger the bug.
    validations:
      required: true
  - type: input
    id: browser
    attributes:
      label: Browser and version
    validations:
      required: true
  - type: input
    id: os
    attributes:
      label: Operating system
    validations:
      required: true
  - type: textarea
    id: media
    attributes:
      label: Screenshots or recordings
      description: Add visual evidence if the issue affects UI or generated output.
    validations:
      required: false
```

- [ ] **Step 4: Create feature request template**

Create `.github/ISSUE_TEMPLATE/feature_request.yml`:

```yaml
name: Feature request
description: Suggest a focused improvement for LocalStudio.ai.
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What user problem should this solve?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposal
      description: Describe the smallest useful version of the feature.
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: List any simpler or different approaches you considered.
    validations:
      required: false
```

- [ ] **Step 5: Create PR template**

Create `.github/pull_request_template.md`:

```md
## Summary

- Summarize the user-visible change.

## Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`

## UI Changes

- [ ] Not a UI change
- [ ] Screenshot or recording attached

## Notes

- Mention browser-specific behavior, follow-up work, or reviewer context.
```

- [ ] **Step 6: Commit**

```bash
git add LICENSE CONTRIBUTING.md .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml .github/pull_request_template.md
git commit -m "Add open source contribution metadata"
```

---

### Task 4: Add Contributor Architecture Documentation

**Files:**
- Create: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Create architecture document**

Create `docs/ARCHITECTURE.md`:

```md
# Architecture

LocalStudio.ai is a browser-only React workspace with a landing app, an editor app, and shared brand tokens.

## Workspace

- `apps/landing` serves the public product page at `/`.
- `apps/editor` serves the editor at `/editor/`.
- `packages/brand` contains shared CSS and design tokens.
- `dist/` is generated by `npm run build` and is not committed.

## Runtime Boundaries

The editor keeps product state in serializable domain objects under `apps/editor/src/domain`. React UI and view-model orchestration live under `apps/editor/src/ui`. Browser integrations live under `apps/editor/src/services`.

## Local-First Storage

Projects are saved through the browser File System Access API. The app writes project metadata and assets to a user-selected folder. Model weights and browser AI caches stay in browser-managed storage, not in the project folder.

## Browser AI

LocalStudio.ai uses Chrome built-in AI APIs when available and WebGPU/Hugging Face model paths for local browser execution. Some flows require Chrome experimental features, WebGPU support, and enough local disk space for model caches.

## Build Output

The production build places the landing app at the site root and the editor under `/editor/`. GitHub Pages builds can set `LOCALSTUDIO_BASE_PATH` so assets work from a project Pages subpath.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "Document project architecture"
```

---

### Task 5: Rewrite README For Showcase Impact

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README**

Replace `README.md` with:

```md
# LocalStudio.ai

[![CI](https://github.com/ErickWendel/canva-webai-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/ErickWendel/canva-webai-clone/actions/workflows/ci.yml)
[![Pages](https://github.com/ErickWendel/canva-webai-clone/actions/workflows/pages.yml/badge.svg)](https://github.com/ErickWendel/canva-webai-clone/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node 26](https://img.shields.io/badge/Node-26-5FA04E?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)

Browser-only Canva-style slides and image editing, powered by local Web AI.

[Live demo](https://erickwendel.github.io/canva-webai-clone/) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

![LocalStudio.ai Web AI demo](apps/landing/public/powered-webau.gif)

## What It Does

LocalStudio.ai runs in the browser: compose slides, generate layouts, create image assets, translate text, edit images, save project history, and export designs without a backend.

| Prompt to slide | Prompt to image |
| --- | --- |
| ![Prompt to slide](apps/landing/public/prompt-to-slide.gif) | ![Prompt to image](apps/landing/public/prompt-to-image.gif) |

| Translate | Edit images |
| --- | --- |
| ![Translate](apps/landing/public/translate.gif) | ![Edit images](apps/landing/public/edit-images.gif) |

| Web AI setup | Local project history |
| --- | --- |
| ![Web AI setup](apps/landing/public/powered-webau.gif) | ![Local project history](apps/landing/public/fs-history.gif) |

## Quick Start

```bash
npm ci
npm run dev
```

Focused local apps:

```bash
npm run dev:landing
npm run dev:editor
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Browser AI Stack

Some features need Chrome experimental APIs, WebGPU, browser-managed model caches, and local folder permissions.

- Chrome APIs: [Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [Translator API](https://developer.chrome.com/docs/ai/translator-api), [Language Detector API](https://developer.chrome.com/docs/ai/language-detection)
- Hugging Face models: [Gemma 4 E2B](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX), [TranslateGemma 4B](https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX), [XLM-RoBERTa language detection](https://huggingface.co/onnx-community/xlm-roberta-base-language-detection-ONNX), [SlimSAM](https://huggingface.co/Xenova/slimsam-77-uniform), [Bonsai Image 4B](https://huggingface.co/prism-ml/bonsai-image-ternary-4B-mlx-2bit)
- WebML references: [Bonsai Image WebGPU Space](https://huggingface.co/spaces/webml-community/bonsai-image-webgpu), [Hugging Face WebML community](https://huggingface.co/webml-community)

## Workspace

- `apps/landing`: product page at `/`
- `apps/editor`: Web AI editor at `/editor/`
- `packages/brand`: shared LocalStudio.ai tokens and CSS

## Roadmap

- More browser/device verification for WebGPU flows.
- Better model selection and generation history.
- Deeper export formats beyond PNG.
- More examples built with the editor.

## License

MIT. See [LICENSE](LICENSE).
```

- [ ] **Step 2: Verify README media paths exist**

Run:

```bash
for file in apps/landing/public/powered-webau.gif apps/landing/public/prompt-to-slide.gif apps/landing/public/prompt-to-image.gif apps/landing/public/translate.gif apps/landing/public/edit-images.gif apps/landing/public/fs-history.gif; do test -f "$file" || exit 1; done
```

Expected: PASS with no output.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Rewrite README for open source showcase"
```

---

### Task 6: Verify Local Apps, CI Commands, And Build Output

**Files:**
- Modify only if verification finds a real blocker.

- [ ] **Step 1: Run static checks**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Run type checks**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 4: Build production output**

Run:

```bash
npm run build
```

Expected: PASS with generated `dist/index.html` and `dist/editor/index.html`.

- [ ] **Step 5: Smoke test landing dev script**

Run:

```bash
npm run dev:landing -- --host 127.0.0.1
```

Expected: Vite prints a local URL and serves the landing app. Stop the server after confirming it starts.

- [ ] **Step 6: Smoke test editor dev script**

Run:

```bash
npm run dev:editor -- --host 127.0.0.1
```

Expected: Vite prints a local URL and serves the editor app. Stop the server after confirming it starts.

- [ ] **Step 7: Smoke test default dev script**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL and serves the landing app. Stop the server after confirming it starts.

- [ ] **Step 8: Inspect production output routes**

Run:

```bash
test -f dist/index.html
test -f dist/editor/index.html
rg -n 'src="/editor/|href="/editor/' dist/editor/index.html
```

Expected: first two commands exit 0; `rg` finds editor asset URLs under `/editor/`.

- [ ] **Step 9: Final status check**

Run:

```bash
git status --short
```

Expected: clean working tree after all implementation commits, unless verification revealed a documented blocker.
