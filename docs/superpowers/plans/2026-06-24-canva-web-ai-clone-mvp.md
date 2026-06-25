# Canva Web AI Clone MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the local-only EW Canvas AI MVP: a browser-based layered slides/image editor with the approved Stitch shell, tabbed right panel, command model, local persistence, export flows, and mocked browser-AI workflows.

**Architecture:** React + Vite renders the approved EW Academy/Stitch UI shell, while domain state lives in immutable TypeScript models updated through command classes. Application services are class-based and injected through a composition root so UI, persistence, export, and AI providers remain testable and replaceable.

**Tech Stack:** React, Vite, TypeScript strict mode, Konva/React Konva, IndexedDB via `idb`, jsPDF, lucide-react, Vitest, Testing Library, fake-indexeddb, Playwright, ESLint, Prettier, Husky.

---

## References

- Spec: `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`
- Stitch handoff: `docs/design/stitch/ew-canvas-ai/README.md`
- AI Tools screen: `docs/design/stitch/ew-canvas-ai/screens/ai-tools.html`
- Design tab screen: `docs/design/stitch/ew-canvas-ai/screens/design.html`
- Layers tab screen: `docs/design/stitch/ew-canvas-ai/screens/layers.html`

## File Structure

Create this structure:

```text
package.json
vite.config.ts
tsconfig.json
tsconfig.node.json
eslint.config.js
prettier.config.cjs
index.html
src/main.tsx
src/App.tsx
src/app/AppProviders.tsx
src/app/composition.ts
src/app/styles.css
src/domain/model.ts
src/domain/sampleProject.ts
src/domain/commands/*.ts
src/domain/commands/index.ts
src/services/interfaces.ts
src/services/inMemoryAiServices.ts
src/services/modelSetupService.ts
src/services/indexedDbProjectRepository.ts
src/services/exportService.ts
src/ui/editor/EditorShell.tsx
src/ui/editor/TopToolbar.tsx
src/ui/editor/PageRail.tsx
src/ui/editor/CanvasWorkspace.tsx
src/ui/editor/FloatingSelectionToolbar.tsx
src/ui/editor/RightPanel.tsx
src/ui/editor/AiToolsPanel.tsx
src/ui/editor/DesignPanel.tsx
src/ui/editor/LayersPanel.tsx
src/ui/editor/PromptBar.tsx
src/ui/editor/useEditorViewModel.ts
src/ui/components/IconButton.tsx
src/ui/components/PanelSection.tsx
src/ui/components/SegmentedTabs.tsx
src/ui/components/StatusPill.tsx
src/test/testUtils.tsx
src/test/fakeServices.ts
tests/e2e/editor.spec.ts
playwright.config.ts
```

Responsibilities:

- `src/domain`: pure document model and commands. No React, DOM, IndexedDB, Konva, or AI provider imports.
- `src/services`: class-based app services and provider interfaces.
- `src/ui`: React presentation and orchestration using injected services.
- `tests/e2e`: browser behavior through Playwright with mocked services.

---

### Task 1: Scaffold Tooling, Tests, and Hooks

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `eslint.config.js`
- Create: `prettier.config.cjs`
- Create: `playwright.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/app/styles.css`
- Create: `src/test/testUtils.tsx`

- [x] **Step 1: Initialize dependencies**

Run:

```bash
npm init -y
npm install react react-dom konva react-konva idb jspdf lucide-react
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fake-indexeddb playwright eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier husky lint-staged
```

Expected: `package.json`, `package-lock.json`, and `node_modules` are created.

- [x] **Step 2: Replace `package.json` scripts**

Use this content as the target shape:

```json
{
  "name": "canva-webai-clone",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,md,json}": [
      "prettier --write"
    ]
  }
}
```

Keep the installed dependency versions that npm wrote.

- [x] **Step 3: Add Vite and TypeScript config**

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/testUtils.tsx',
  },
});
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

- [x] **Step 4: Add lint/format/test bootstraps**

`eslint.config.js`:

```js
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'docs/design/stitch/**/*.html'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
```

`prettier.config.cjs`:

```js
module.exports = {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
};
```

`src/test/testUtils.tsx`:

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [x] **Step 5: Add app entry files**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EW Canvas AI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './app/styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:

```tsx
export function App() {
  return <main data-testid="app-root">EW Canvas AI</main>;
}
```

- [x] **Step 6: Add Husky pre-commit hook**

Run:

```bash
npm run prepare
npx husky init
```

Replace `.husky/pre-commit` with:

```sh
npm run lint
npm run typecheck
npm run test
```

- [x] **Step 7: Verify scaffold**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all commands pass.

- [x] **Step 8: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json eslint.config.js prettier.config.cjs playwright.config.ts src .husky
git commit -m "chore: scaffold React editor app"
```

---

### Task 2: Define Domain Model and Sample Project

**Files:**
- Create: `src/domain/model.ts`
- Create: `src/domain/sampleProject.ts`
- Create: `src/domain/model.test.ts`

- [x] **Step 1: Write model tests**

`src/domain/model.test.ts`:

```ts
import { createSampleProject } from './sampleProject';

describe('project model', () => {
  it('creates a page-based layered project', () => {
    const project = createSampleProject();
    const firstPage = project.pages[0];

    expect(project.name).toBe('Untitled AI Deck');
    expect(firstPage?.width).toBe(1920);
    expect(firstPage?.height).toBe(1080);
    expect(firstPage?.elementIds.length).toBeGreaterThan(2);
  });

  it('keeps z-order as page elementIds', () => {
    const project = createSampleProject();
    const firstPage = project.pages[0]!;
    const topElementId = firstPage.elementIds.at(-1);

    expect(project.elements[topElementId!]?.type).toBe('text');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/domain/model.test.ts
```

Expected: FAIL because `sampleProject` does not exist.

- [x] **Step 3: Implement model types**

`src/domain/model.ts`:

```ts
export type ElementType = 'text' | 'image' | 'shape';

export interface ProjectDocument {
  id: string;
  name: string;
  pages: Page[];
  assets: Record<string, Asset>;
  elements: Record<string, DesignElement>;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  name: string;
  width: number;
  height: number;
  background: PageBackground;
  elementIds: string[];
}

export type PageBackground =
  | { type: 'color'; color: string }
  | { type: 'asset'; assetId: string; colorFallback: string };

export interface Asset {
  id: string;
  type: 'image';
  name: string;
  mimeType: string;
  objectUrl?: string;
}

export type DesignElement = TextElement | ImageElement | ShapeElement;

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  opacity: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: string;
  crop?: CropRect;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionState {
  pageId: string;
  elementIds: string[];
}
```

- [x] **Step 4: Implement sample project**

`src/domain/sampleProject.ts`:

```ts
import type { ProjectDocument } from './model';

export function createSampleProject(): ProjectDocument {
  const now = new Date('2026-06-24T00:00:00.000Z').toISOString();

  return {
    id: 'project-1',
    name: 'Untitled AI Deck',
    createdAt: now,
    updatedAt: now,
    assets: {
      'asset-hero': {
        id: 'asset-hero',
        type: 'image',
        name: 'Futuristic landscape',
        mimeType: 'image/png',
      },
    },
    pages: [
      {
        id: 'page-1',
        name: 'Slide 1',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: ['shape-bg', 'image-hero', 'text-subtitle', 'text-title'],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
      },
      {
        id: 'page-3',
        name: 'Slide 3',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
      },
    ],
    elements: {
      'shape-bg': {
        id: 'shape-bg',
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        rotation: 0,
        locked: false,
        opacity: 1,
        fill: '#050D10',
      },
      'image-hero': {
        id: 'image-hero',
        type: 'image',
        assetId: 'asset-hero',
        x: 360,
        y: 210,
        width: 1200,
        height: 650,
        rotation: 0,
        locked: false,
        opacity: 1,
      },
      'text-subtitle': {
        id: 'text-subtitle',
        type: 'text',
        text: 'Browser-native creative automation',
        x: 580,
        y: 690,
        width: 760,
        height: 80,
        rotation: 0,
        locked: false,
        opacity: 1,
        fontFamily: 'Open Sans',
        fontSize: 40,
        fontWeight: 600,
        fill: '#FFFFFF',
        align: 'center',
      },
      'text-title': {
        id: 'text-title',
        type: 'text',
        text: 'AI Design Revolution',
        x: 440,
        y: 420,
        width: 1040,
        height: 170,
        rotation: 0,
        locked: false,
        opacity: 1,
        fontFamily: 'Orbitron',
        fontSize: 96,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      },
    },
  };
}
```

- [x] **Step 5: Verify**

Run:

```bash
npm run test -- src/domain/model.test.ts
npm run typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: define editor document model"
```

---

### Task 3: Implement Immutable Editor Commands

**Files:**
- Create: `src/domain/commands/types.ts`
- Create: `src/domain/commands/basicCommands.ts`
- Create: `src/domain/commands/aiCommands.ts`
- Create: `src/domain/commands/index.ts`
- Create: `src/domain/commands/basicCommands.test.ts`

- [x] **Step 1: Write command tests**

`src/domain/commands/basicCommands.test.ts`:

```ts
import { createSampleProject } from '../sampleProject';
import { AlignElementCommand, DeleteElementCommand, SetZOrderCommand } from './basicCommands';

describe('editor commands', () => {
  it('aligns an element to page horizontal center immutably', () => {
    const project = createSampleProject();
    const command = new AlignElementCommand('page-1', 'image-hero', 'horizontal-center');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']?.x).toBe((1920 - 1200) / 2);
    expect(project.elements['image-hero']?.x).toBe(360);
  });

  it('brings an element to front by moving its id to the end', () => {
    const project = createSampleProject();
    const command = new SetZOrderCommand('page-1', 'image-hero', 'front');
    const next = command.execute(project);

    expect(next.pages[0]?.elementIds.at(-1)).toBe('image-hero');
  });

  it('deletes an element and removes it from z-order', () => {
    const project = createSampleProject();
    const command = new DeleteElementCommand('page-1', 'text-subtitle');
    const next = command.execute(project);

    expect(next.elements['text-subtitle']).toBeUndefined();
    expect(next.pages[0]?.elementIds).not.toContain('text-subtitle');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/domain/commands/basicCommands.test.ts
```

Expected: FAIL because command classes do not exist.

- [x] **Step 3: Add command interface**

`src/domain/commands/types.ts`:

```ts
import type { ProjectDocument } from '../model';

export interface EditorCommand {
  readonly description: string;
  execute(project: ProjectDocument): ProjectDocument;
}
```

- [x] **Step 4: Add basic commands**

`src/domain/commands/basicCommands.ts`:

```ts
import type { ProjectDocument } from '../model';
import type { EditorCommand } from './types';

export type AlignMode = 'horizontal-center' | 'vertical-center' | 'page-center';
export type ZOrderMode = 'front' | 'back' | 'forward' | 'backward';

export class AlignElementCommand implements EditorCommand {
  readonly description = 'Align element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly mode: AlignMode,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    const element = project.elements[this.elementId];
    if (!page || !element || element.locked) return project;

    const patch = {
      x:
        this.mode === 'horizontal-center' || this.mode === 'page-center'
          ? (page.width - element.width) / 2
          : element.x,
      y:
        this.mode === 'vertical-center' || this.mode === 'page-center'
          ? (page.height - element.height) / 2
          : element.y,
    };

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: { ...element, ...patch },
      },
    };
  }
}

export class SetZOrderCommand implements EditorCommand {
  readonly description = 'Set z-order';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly mode: ZOrderMode,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId || !page.elementIds.includes(this.elementId)) return page;
        const without = page.elementIds.filter((id) => id !== this.elementId);
        const currentIndex = page.elementIds.indexOf(this.elementId);

        if (this.mode === 'front') return { ...page, elementIds: [...without, this.elementId] };
        if (this.mode === 'back') return { ...page, elementIds: [this.elementId, ...without] };

        const targetIndex =
          this.mode === 'forward'
            ? Math.min(currentIndex + 1, page.elementIds.length - 1)
            : Math.max(currentIndex - 1, 0);
        const next = [...without];
        next.splice(targetIndex, 0, this.elementId);
        return { ...page, elementIds: next };
      }),
    };
  }
}

export class DeleteElementCommand implements EditorCommand {
  readonly description = 'Delete element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const { [this.elementId]: _deleted, ...remainingElements } = project.elements;
    return {
      ...project,
      elements: remainingElements,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? { ...page, elementIds: page.elementIds.filter((id) => id !== this.elementId) }
          : page,
      ),
    };
  }
}
```

- [x] **Step 5: Add AI command classes with real behavior**

`src/domain/commands/aiCommands.ts`:

```ts
import type { ImageElement, ProjectDocument, TextElement } from '../model';
import type { EditorCommand } from './types';

export class TranslateTextCommand implements EditorCommand {
  readonly description = 'Translate text';

  constructor(
    private readonly elementId: string,
    private readonly translatedText: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'text') return project;
    const nextElement: TextElement = { ...element, text: this.translatedText };
    return { ...project, elements: { ...project.elements, [this.elementId]: nextElement } };
  }
}

export class ReplaceImageAssetCommand implements EditorCommand {
  readonly description = 'Replace image asset';

  constructor(
    private readonly elementId: string,
    private readonly assetId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'image') return project;
    const nextElement: ImageElement = { ...element, assetId: this.assetId };
    return { ...project, elements: { ...project.elements, [this.elementId]: nextElement } };
  }
}
```

`src/domain/commands/index.ts`:

```ts
export * from './types';
export * from './basicCommands';
export * from './aiCommands';
```

- [x] **Step 6: Verify**

```bash
npm run test -- src/domain/commands/basicCommands.test.ts
npm run typecheck
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/domain/commands
git commit -m "feat: add immutable editor commands"
```

---

### Task 4: Build App Composition and Mock Services

**Files:**
- Create: `src/services/interfaces.ts`
- Create: `src/services/inMemoryAiServices.ts`
- Create: `src/services/modelSetupService.ts`
- Create: `src/app/composition.ts`
- Create: `src/app/AppProviders.tsx`
- Create: `src/test/fakeServices.ts`
- Create: `src/services/modelSetupService.test.ts`

- [x] **Step 1: Write model setup tests**

`src/services/modelSetupService.test.ts`:

```ts
import { InMemoryModelSetupService } from './modelSetupService';

describe('InMemoryModelSetupService', () => {
  it('downloads required models in parallel and exposes progress', async () => {
    const service = new InMemoryModelSetupService();
    await service.downloadRequiredModels();

    const states = await service.getModelStates();
    expect(states.every((state) => state.status === 'ready')).toBe(true);
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({
      id: 'image-editing-models',
      label: 'Image Editing Models',
      description: 'Segmentation model for image editing.',
    });
  });
});
```

- [x] **Step 2: Run failing test**

```bash
npm run test -- src/services/modelSetupService.test.ts
```

Expected: FAIL because service does not exist.

- [x] **Step 3: Define service interfaces**

`src/services/interfaces.ts`:

```ts
import type { ProjectDocument } from '../domain/model';

export type ModelStatus = 'unavailable' | 'needs-download' | 'downloading' | 'ready' | 'failed';

export interface ModelState {
  id: string;
  label: string;
  provider: 'chrome' | 'transformers';
  status: ModelStatus;
  progress: number;
  required: boolean;
}

export interface ProjectRepository {
  loadProject(): Promise<ProjectDocument | null>;
  saveProject(project: ProjectDocument): Promise<void>;
}

export interface ModelSetupService {
  getModelStates(): Promise<ModelState[]>;
  downloadRequiredModels(): Promise<ModelState[]>;
  downloadModel(id: string): Promise<ModelState>;
}

export interface TranslatorService {
  detectLanguage(text: string): Promise<string>;
  translate(text: string, targetLanguage: string): Promise<string>;
}

export interface PaletteService {
  generatePalette(prompt: string): Promise<{ name: string; colors: string[] }>;
}

export interface BackgroundRemovalService {
  removeBackground(assetId: string): Promise<{ assetId: string }>;
}

export interface SmartGrabService {
  suggestSubjectRegion(assetId: string, aspectRatio: number): Promise<{ x: number; y: number; width: number; height: number }>;
}

export interface MagicEraserService {
  createMask(assetId: string, points: Array<{ x: number; y: number; positive: boolean }>): Promise<{ maskAssetId: string }>;
}
```

- [x] **Step 4: Implement model setup service**

`src/services/modelSetupService.ts`:

```ts
import type { ModelSetupService, ModelState } from './interfaces';

const initialStates: ModelState[] = [
  {
    id: 'image-editing-models',
    label: 'Image Editing Models',
    description: 'Segmentation model for image editing.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: true,
  },
];

export class InMemoryModelSetupService implements ModelSetupService {
  private states = initialStates.map((state) => ({ ...state }));

  async getModelStates(): Promise<ModelState[]> {
    return this.states.map((state) => ({ ...state }));
  }

  async downloadRequiredModels(): Promise<ModelState[]> {
    await Promise.all(this.states.filter((state) => state.required).map((state) => this.downloadModel(state.id)));
    return this.getModelStates();
  }

  async downloadModel(id: string): Promise<ModelState> {
    const current = this.states.find((state) => state.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);
    this.states = this.states.map((state) =>
      state.id === id ? { ...state, status: 'ready', progress: 100 } : state,
    );
    return this.states.find((state) => state.id === id)!;
  }
}
```

- [x] **Step 5: Implement mock AI services and composition**

`src/services/inMemoryAiServices.ts`:

```ts
import type { BackgroundRemovalService, MagicEraserService, PaletteService, SmartGrabService, TranslatorService } from './interfaces';

export class MockTranslatorService implements TranslatorService {
  async detectLanguage(): Promise<string> {
    return 'PT-BR';
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    return `[${targetLanguage}] ${text}`;
  }
}

export class MockPaletteService implements PaletteService {
  async generatePalette(prompt: string): Promise<{ name: string; colors: string[] }> {
    return {
      name: prompt || 'EW Neon',
      colors: ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'],
    };
  }
}

export class MockBackgroundRemovalService implements BackgroundRemovalService {
  async removeBackground(assetId: string): Promise<{ assetId: string }> {
    return { assetId: `${assetId}-transparent` };
  }
}

export class MockSmartGrabService implements SmartGrabService {
  async suggestSubjectRegion(): Promise<{ x: number; y: number; width: number; height: number }> {
    return { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
  }
}

export class MockMagicEraserService implements MagicEraserService {
  async createMask(assetId: string): Promise<{ maskAssetId: string }> {
    return { maskAssetId: `${assetId}-mask` };
  }
}
```

`src/app/composition.ts`:

```ts
import { createSampleProject } from '../domain/sampleProject';
import { MockBackgroundRemovalService, MockMagicEraserService, MockPaletteService, MockSmartGrabService, MockTranslatorService } from '../services/inMemoryAiServices';
import { InMemoryModelSetupService } from '../services/modelSetupService';

export function createAppServices() {
  return {
    initialProject: createSampleProject(),
    modelSetupService: new InMemoryModelSetupService(),
    translatorService: new MockTranslatorService(),
    paletteService: new MockPaletteService(),
    backgroundRemovalService: new MockBackgroundRemovalService(),
    smartGrabService: new MockSmartGrabService(),
    magicEraserService: new MockMagicEraserService(),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
```

- [x] **Step 6: Verify**

```bash
npm run test -- src/services/modelSetupService.test.ts
npm run typecheck
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/services src/app/composition.ts
git commit -m "feat: add service interfaces and mock providers"
```

---

### Task 5: Implement Stitch-Based Editor Shell

**Files:**
- Modify: `src/App.tsx`
- Create: `src/app/AppProviders.tsx`
- Create: `src/app/styles.css`
- Create: `src/ui/editor/EditorShell.tsx`
- Create: `src/ui/editor/TopToolbar.tsx`
- Create: `src/ui/editor/PageRail.tsx`
- Create: `src/ui/editor/CanvasWorkspace.tsx`
- Create: `src/ui/editor/FloatingSelectionToolbar.tsx`
- Create: `src/ui/editor/PromptBar.tsx`
- Create: `src/ui/editor/useEditorViewModel.ts`
- Create: `src/ui/components/IconButton.tsx`
- Create: `src/ui/editor/EditorShell.test.tsx`

- [x] **Step 1: Write shell render test**

`src/ui/editor/EditorShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createAppServices } from '../../app/composition';
import { EditorShell } from './EditorShell';

describe('EditorShell', () => {
  it('renders the approved editor shell landmarks', async () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByText('EW Canvas AI')).toBeInTheDocument();
    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(screen.getByText('PT-BR')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe slide structure or organize current content...')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
  });
});
```

- [x] **Step 2: Run failing test**

```bash
npm run test -- src/ui/editor/EditorShell.test.tsx
```

Expected: FAIL because `EditorShell` does not exist.

- [x] **Step 3: Add global styles matching Stitch handoff**

`src/app/styles.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300..800&family=Orbitron:wght@400..900&display=swap');

:root {
  color-scheme: dark;
  --ew-bg: #050d10;
  --ew-black: #000000;
  --ew-panel: #040404;
  --ew-raised: #0c1618;
  --ew-border: #1e2939;
  --ew-green: #37fd76;
  --ew-green-hover: #00ff22;
  --ew-text: #ffffff;
  --ew-muted: #91999d;
  --ew-dim: #696969;
  font-family: 'Open Sans', Helvetica, sans-serif;
  background: var(--ew-bg);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 1024px;
  min-height: 100vh;
  background: var(--ew-bg);
  color: var(--ew-text);
}

button,
input,
select {
  font: inherit;
}

.font-orbitron {
  font-family: 'Orbitron', sans-serif;
}

.app-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: 56px 1fr;
  background: var(--ew-bg);
  overflow: hidden;
}

.top-toolbar,
.page-rail,
.right-panel {
  background: var(--ew-panel);
  border-color: rgba(55, 253, 118, 0.16);
}

.neon-border {
  border: 1px solid rgba(55, 253, 118, 0.72);
  box-shadow: 0 0 12px rgba(55, 253, 118, 0.24);
}
```

- [x] **Step 4: Add reusable icon button**

`src/ui/components/IconButton.tsx`:

```tsx
import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function IconButton({ label, children, active = false, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={active ? 'icon-button icon-button-active' : 'icon-button'}
      type="button"
    >
      {children}
    </button>
  );
}
```

Append to `src/app/styles.css`:

```css
.icon-button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ew-muted);
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  cursor: pointer;
}

.icon-button:hover,
.icon-button-active {
  color: var(--ew-green);
  border-color: var(--ew-green);
}
```

- [x] **Step 5: Implement shell components**

`src/ui/editor/EditorShell.tsx`:

```tsx
import type { AppServices } from '../../app/composition';
import { CanvasWorkspace } from './CanvasWorkspace';
import { PageRail } from './PageRail';
import { PromptBar } from './PromptBar';
import { RightPanel } from './RightPanel';
import { TopToolbar } from './TopToolbar';
import { useEditorViewModel } from './useEditorViewModel';

interface EditorShellProps {
  services: AppServices;
}

export function EditorShell({ services }: EditorShellProps) {
  const vm = useEditorViewModel(services);

  return (
    <div className="app-shell">
      <TopToolbar project={vm.project} language="PT-BR" />
      <div className="editor-grid">
        <PageRail project={vm.project} activePageId={vm.activePageId} />
        <section className="workspace-column" aria-label="Canvas workspace">
          <CanvasWorkspace project={vm.project} activePageId={vm.activePageId} selection={vm.selection} />
          <PromptBar />
        </section>
        <RightPanel activeTab={vm.activeTab} onTabChange={vm.setActiveTab} modelStates={vm.modelStates} />
      </div>
    </div>
  );
}
```

`src/ui/editor/useEditorViewModel.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import type { AppServices } from '../../app/composition';
import type { ProjectDocument, SelectionState } from '../../domain/model';
import type { ModelState } from '../../services/interfaces';

export type RightPanelTab = 'design' | 'layers' | 'ai-tools';

export function useEditorViewModel(services: AppServices) {
  const [project] = useState<ProjectDocument>(services.initialProject);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('ai-tools');
  const [modelStates, setModelStates] = useState<ModelState[]>([]);
  const activePageId = project.pages[0]?.id ?? '';
  const selection = useMemo<SelectionState>(() => ({ pageId: activePageId, elementIds: ['image-hero'] }), [activePageId]);

  useEffect(() => {
    void services.modelSetupService.getModelStates().then(setModelStates);
  }, [services.modelSetupService]);

  return { project, activePageId, selection, activeTab, setActiveTab, modelStates };
}
```

`src/App.tsx`:

```tsx
import { createAppServices } from './app/composition';
import { EditorShell } from './ui/editor/EditorShell';

const services = createAppServices();

export function App() {
  return <EditorShell services={services} />;
}
```

- [x] **Step 6: Implement toolbar, rail, canvas, and prompt**

Use the Stitch handoff for visual details. Include exact component behavior:

`TopToolbar` renders logo, project name, undo/redo, zoom, export button, language chip.

`PageRail` renders three page thumbnails and import/add buttons.

`CanvasWorkspace` renders a 16:9 stage area and floating toolbar with align, z-order, duplicate, lock, delete, remove background, translate.

`PromptBar` renders the prompt input below the main canvas with spark, microphone, and submit buttons.

- [x] **Step 7: Verify**

```bash
npm run test -- src/ui/editor/EditorShell.test.tsx
npm run lint
npm run typecheck
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/App.tsx src/app src/ui
git commit -m "feat: build approved editor shell"
```

---

### Task 6: Implement Right Panel Tabs

**Files:**
- Create: `src/ui/components/PanelSection.tsx`
- Create: `src/ui/components/SegmentedTabs.tsx`
- Create: `src/ui/components/StatusPill.tsx`
- Create: `src/ui/editor/RightPanel.tsx`
- Create: `src/ui/editor/AiToolsPanel.tsx`
- Create: `src/ui/editor/DesignPanel.tsx`
- Create: `src/ui/editor/LayersPanel.tsx`
- Create: `src/ui/editor/RightPanel.test.tsx`

- [x] **Step 1: Write tab behavior test**

`src/ui/editor/RightPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RightPanel } from './RightPanel';

const modelStates = [
  {
    id: 'image-editing-models',
    label: 'Image Editing Models',
    description: 'Segmentation model for image editing.',
    provider: 'transformers' as const,
    status: 'needs-download' as const,
    progress: 0,
    required: true,
  },
];

describe('RightPanel', () => {
  it('switches between AI Tools, Design, and Layers tabs', async () => {
    const user = userEvent.setup();
    let activeTab: 'design' | 'layers' | 'ai-tools' = 'ai-tools';
    const onTabChange = vi.fn((tab) => {
      activeTab = tab;
    });

    const { rerender } = render(
      <RightPanel activeTab={activeTab} onTabChange={onTabChange} modelStates={modelStates} />,
    );

    expect(screen.getByText('Download Required Models')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    rerender(<RightPanel activeTab="design" onTabChange={onTabChange} modelStates={modelStates} />);
    expect(screen.getByText('16:9 Presentation')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Layers' }));
    rerender(<RightPanel activeTab="layers" onTabChange={onTabChange} modelStates={modelStates} />);
    expect(screen.getByText('5 layers on current page')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run failing test**

```bash
npm run test -- src/ui/editor/RightPanel.test.tsx
```

Expected: FAIL until components exist.

- [x] **Step 3: Implement tabs and panels**

Implement:

- `AiToolsPanel`: download all button, rows for Translate Design, Text-to-Palette, Image Editing Models with download icons/progress.
- `DesignPanel`: page size, background, palette swatches, typography, layout toggles, element style, compact Text-to-Palette.
- `LayersPanel`: search input, layer rows with drag/eye/lock/type icons, selected image highlighted, group/z-order actions, properties.

Use text and labels from `docs/design/stitch/ew-canvas-ai/screens/*.html`.

- [x] **Step 4: Verify**

```bash
npm run test -- src/ui/editor/RightPanel.test.tsx
npm run lint
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/ui/components src/ui/editor/RightPanel.tsx src/ui/editor/AiToolsPanel.tsx src/ui/editor/DesignPanel.tsx src/ui/editor/LayersPanel.tsx
git commit -m "feat: implement editor right panel tabs"
```

---

### Task 7: Add Konva Canvas Rendering and Selection

**Files:**
- Modify: `src/ui/editor/CanvasWorkspace.tsx`
- Create: `src/ui/editor/CanvasWorkspace.test.tsx`

- [x] **Step 1: Write canvas rendering test**

`src/ui/editor/CanvasWorkspace.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createSampleProject } from '../../domain/sampleProject';
import { CanvasWorkspace } from './CanvasWorkspace';

describe('CanvasWorkspace', () => {
  it('renders page elements and selected image toolbar', () => {
    const project = createSampleProject();
    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    expect(screen.getByLabelText('Slide canvas')).toBeInTheDocument();
    expect(screen.getByText('AI Design Revolution')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Background')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run failing test**

```bash
npm run test -- src/ui/editor/CanvasWorkspace.test.tsx
```

Expected: FAIL until the component renders document elements and selection controls.

- [x] **Step 3: Implement Konva rendering**

Use `Stage`, `Layer`, `Rect`, `Text`, and `Image` from `react-konva`.

For image assets without object URLs, render a technical fallback rectangle with label `Selected Image`. Render text elements with absolute page coordinates scaled to fit the visible 16:9 canvas.

- [x] **Step 4: Verify**

```bash
npm run test -- src/ui/editor/CanvasWorkspace.test.tsx
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/ui/editor/CanvasWorkspace.tsx src/ui/editor/CanvasWorkspace.test.tsx
git commit -m "feat: render document elements on canvas"
```

---

### Task 8: Add IndexedDB Local Persistence

**Files:**
- Create: `src/services/indexedDbProjectRepository.ts`
- Create: `src/services/indexedDbProjectRepository.test.ts`
- Modify: `src/app/composition.ts`
- Modify: `src/ui/editor/useEditorViewModel.ts`

- [x] **Step 1: Write repository test**

`src/services/indexedDbProjectRepository.test.ts`:

```ts
import { createSampleProject } from '../domain/sampleProject';
import { IndexedDbProjectRepository } from './indexedDbProjectRepository';

describe('IndexedDbProjectRepository', () => {
  it('saves and loads the current project', async () => {
    const repository = new IndexedDbProjectRepository('ew-canvas-test');
    const project = createSampleProject();

    await repository.saveProject(project);
    const loaded = await repository.loadProject();

    expect(loaded?.id).toBe(project.id);
    expect(loaded?.pages).toHaveLength(3);
  });
});
```

- [x] **Step 2: Implement repository with `idb`**

`src/services/indexedDbProjectRepository.ts`:

```ts
import { openDB, type DBSchema } from 'idb';
import type { ProjectDocument } from '../domain/model';
import type { ProjectRepository } from './interfaces';

interface EwCanvasDb extends DBSchema {
  projects: {
    key: string;
    value: ProjectDocument;
  };
}

export class IndexedDbProjectRepository implements ProjectRepository {
  constructor(private readonly dbName = 'ew-canvas-ai') {}

  private async db() {
    return openDB<EwCanvasDb>(this.dbName, 1, {
      upgrade(database) {
        database.createObjectStore('projects');
      },
    });
  }

  async loadProject(): Promise<ProjectDocument | null> {
    const db = await this.db();
    return (await db.get('projects', 'current')) ?? null;
  }

  async saveProject(project: ProjectDocument): Promise<void> {
    const db = await this.db();
    await db.put('projects', project, 'current');
  }
}
```

- [x] **Step 3: Wire repository into composition**

Update `createAppServices()` to include:

```ts
projectRepository: new IndexedDbProjectRepository(),
```

Update `useEditorViewModel` to load saved project on mount and autosave after changes.

- [x] **Step 4: Verify**

```bash
npm run test -- src/services/indexedDbProjectRepository.test.ts
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/services/indexedDbProjectRepository.ts src/services/indexedDbProjectRepository.test.ts src/app/composition.ts src/ui/editor/useEditorViewModel.ts
git commit -m "feat: persist projects in IndexedDB"
```

---

### Task 9: Add Export Service

**Files:**
- Create: `src/services/exportService.ts`
- Create: `src/services/exportService.test.ts`
- Modify: `src/services/interfaces.ts`
- Modify: `src/ui/editor/TopToolbar.tsx`

- [x] **Step 1: Write export service test**

`src/services/exportService.test.ts`:

```ts
import { createSampleProject } from '../domain/sampleProject';
import { BrowserExportService } from './exportService';

describe('BrowserExportService', () => {
  it('creates export file names for page images and PDF', async () => {
    const service = new BrowserExportService();
    const project = createSampleProject();

    expect(service.getPageImageFileName(project, 'page-1', 'png')).toBe('Untitled AI Deck-Slide 1.png');
    expect(service.getPdfFileName(project)).toBe('Untitled AI Deck.pdf');
  });
});
```

- [x] **Step 2: Implement export service**

`src/services/exportService.ts`:

```ts
import type { ProjectDocument } from '../domain/model';

export class BrowserExportService {
  getPageImageFileName(project: ProjectDocument, pageId: string, extension: 'png' | 'jpeg'): string {
    const page = project.pages.find((item) => item.id === pageId);
    const pageName = page?.name ?? 'Page';
    return `${project.name}-${pageName}.${extension}`;
  }

  getPdfFileName(project: ProjectDocument): string {
    return `${project.name}.pdf`;
  }

  downloadDataUrl(dataUrl: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.click();
  }
}
```

- [x] **Step 3: Wire export button**

`TopToolbar` should show the export button treatment from `docs/design/stitch/ew-canvas-ai/screens/design.html`.

Clicking Export in MVP opens a compact menu or uses a basic `window.alert('Export PNG/PDF wiring ready')` until canvas export wiring is added in a later task. The visible UI must match the design now.

- [x] **Step 4: Verify**

```bash
npm run test -- src/services/exportService.test.ts
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/services/exportService.ts src/services/exportService.test.ts src/ui/editor/TopToolbar.tsx
git commit -m "feat: add local export service shell"
```

---

### Task 10: Implement Mocked AI Flows in UI

**Files:**
- Modify: `src/ui/editor/AiToolsPanel.tsx`
- Modify: `src/ui/editor/FloatingSelectionToolbar.tsx`
- Modify: `src/ui/editor/useEditorViewModel.ts`
- Create: `src/ui/editor/aiFlows.test.tsx`

- [x] **Step 1: Write AI flow tests**

`src/ui/editor/aiFlows.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppServices } from '../../app/composition';
import { EditorShell } from './EditorShell';

describe('mocked AI flows', () => {
  it('downloads required models from AI Tools panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Download Required Models' }));

    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });

  it('exposes selected-object AI shortcuts', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByLabelText('Remove Background')).toBeInTheDocument();
    expect(screen.getByLabelText('Translate This Design')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Implement callbacks**

`useEditorViewModel` exposes:

```ts
async function downloadRequiredModels() {
  const next = await services.modelSetupService.downloadRequiredModels();
  setModelStates(next);
}
```

Pass it to `AiToolsPanel`.

- [x] **Step 3: Wire buttons**

`AiToolsPanel` button:

```tsx
<button type="button" onClick={onDownloadRequiredModels}>
  Download Required Models
</button>
```

Floating toolbar keeps `aria-label="Remove Background"` and `aria-label="Translate This Design"`.

- [x] **Step 4: Verify**

```bash
npm run test -- src/ui/editor/aiFlows.test.tsx
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/ui/editor
git commit -m "feat: wire mocked AI editor flows"
```

---

### Task 11: Add Playwright E2E Coverage

**Files:**
- Create: `tests/e2e/editor.spec.ts`
- Modify: `playwright.config.ts`

- [x] **Step 1: Configure Playwright**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [x] **Step 2: Write E2E tests**

`tests/e2e/editor.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('renders the editor shell and tabs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('EW Canvas AI')).toBeVisible();
  await expect(page.getByText('Untitled AI Deck')).toBeVisible();
  await expect(page.getByPlaceholder('Describe slide structure or organize current content...')).toBeVisible();

  await page.getByRole('tab', { name: 'Design' }).click();
  await expect(page.getByText('16:9 Presentation')).toBeVisible();

  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByText('5 layers on current page')).toBeVisible();

  await page.getByRole('tab', { name: 'AI Tools' }).click();
  await expect(page.getByRole('button', { name: 'Download Required Models' })).toBeVisible();
});

test('downloads required model states', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Download Required Models' }).click();
  await expect(page.getByText('Ready').first()).toBeVisible();
});
```

- [x] **Step 3: Run Playwright install if needed**

Run:

```bash
npx playwright install chromium
```

Expected: Chromium browser is available.

- [x] **Step 4: Verify E2E**

```bash
npm run e2e
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/editor.spec.ts
git commit -m "test: add editor Playwright coverage"
```

---

### Task 12: Final Verification and Handoff

**Files:**
- Modify: `README.md`

- [x] **Step 1: Create README**

`README.md`:

```md
# EW Canvas AI

Browser-only Canva-style slides and image editor MVP.

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
```

- [x] **Step 2: Run complete verification**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

Expected: all pass.

- [x] **Step 3: Start dev server for manual review**

```bash
npm run dev -- --host 127.0.0.1
```

Expected: app available at `http://127.0.0.1:5173/`.

- [x] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add local development handoff"
```

---

### Remaining Work / Design Compliance Cleanup

These items were identified after the first implementation pass and must be handled before treating the MVP as review-ready on `main`.

Completed implementation commits on `feat/ew-canvas-ai-mvp`:

- `7206e64` scaffolded React/Vite tooling.
- `b448990` defined the editor document model.
- `511d222` added immutable editor commands.
- `4aba185` added service interfaces and mock providers.
- `2583b27` built the editor shell.
- `dd9da2c` implemented right-panel tabs.
- `f66a3ab` rendered document elements on the canvas.
- `faf23ee` added IndexedDB persistence.
- `4fb0493` added the local export service shell.
- `feaa47e` wired mocked AI editor flows.
- `4ee7fa2` added Playwright coverage.
- `bd43352` added the README handoff.
- `d297a32` aligned the editor shell with the Stitch design.

- [x] **Header menu interactions:** File, Edit, View, and Help open Stitch-styled dropdown menus. Actions backed by local state/services are wired; future actions render disabled.
- [x] **Hover/focus animation polish:** strengthened hover, active, and focus-visible states for the toolbar, rail, right-panel tabs, prompt bar, model rows, and selection toolbar without changing the Stitch visual language.
- [x] **Konva editability:** element selection, drag, resize, and rotate are enabled with Konva `Transformer`; changes persist through immutable document state updates while preserving `page.elementIds` z-order.
- [x] **Test organization:** unit/component tests moved from `src` to `tests/unit`, shared setup moved to `tests/setup`, and Playwright specs remain in `tests/e2e`.
- [x] **Main branch integration:** merged `feat/ew-canvas-ai-mvp` into `main`.

Cleanup verification note:

- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` passed on the cleanup branch before the user requested skipping test iteration.
- `npm run e2e` was intentionally deferred for faster iteration after Playwright exposed stale/browser-flow failures during this cleanup pass.

---

## Self-Review

- Spec coverage: editor shell, local-only UX, Stitch visual source, EW Academy branding, layered document model, command model, DI services, model download UX, prompt bar, tab panels, persistence, export service shell, mocked AI flows, unit tests, Playwright, lint/typecheck/hooks are covered.
- Deliberate deferrals: real Chrome Built-in AI, real Transformers.js inference, real canvas image/PDF export bytes, and actual audio transcription are not implemented in this first plan. The plan creates the testable seams and mocked UI flows required before real provider work.
- Completion-marker scan: no open-ended completion markers are used. Tasks that defer real providers explicitly define mocks and service interfaces.
- Type consistency: `ProjectDocument`, `Page`, `DesignElement`, `ModelState`, `ModelSetupService`, and tab names are used consistently across tasks.
