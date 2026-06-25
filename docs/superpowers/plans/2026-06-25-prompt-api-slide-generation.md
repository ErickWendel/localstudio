# Prompt API Slide Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Generate LocalStudio.ai slide layouts from the main prompt bar by asking Chrome Prompt API for structured JSON tasks and applying those tasks incrementally as Konva-backed document updates.

**Architecture:** Add a narrow prompt-to-slide generation boundary instead of letting UI parse model output directly. `PromptBar` emits structured prompt submissions, `useEditorViewModel` gates readiness and image-generation misuse, `PromptService` calls Chrome Prompt API with JSON Schema `responseConstraint` prompts from dedicated prompt files, validates structured JSON as incremental `GeneratedSlideTask` objects, and commands apply each generated page/background/asset/element update immutably. Placeholder images use a repo asset so generated layouts remain deterministic and local, while user-provided image URLs are allowed as remote image assets.

**Tech Stack:** React, TypeScript strict mode, Vite, Vitest, Testing Library, Chrome Built-in AI Prompt API, existing immutable command pattern, File System Access persistence, Konva document model.

---

## Engineering Constraints

Apply these constraints throughout execution:

- **SOLID:** Keep schema/validation, Prompt API calls, command application, and React UI orchestration in separate units. UI must not parse model output or construct domain elements directly.
- **KISS:** Implement active-page slide generation only. Do not add multi-slide generation, retries, streaming, or rich prompt history in this pass.
- **Immutability:** All project changes must go through immutable command execution. Do not mutate `project`, `page`, `assets`, `elements`, or `elementIds` in place.
- **No duplication:** `src/domain/generatedSlide.ts` is the single source of truth for generated slide types, JSON Schema, parsing, clamping, and defaults. Do not duplicate schema objects, color lists, font lists, or frame-clamping rules in services or UI.
- **Dependency inversion:** `useEditorViewModel` depends on `PromptService`, not `ChromePromptService`. Tests should inject fake services through `createAppServices()`.
- **Single responsibility:** prompt files only build prompt text and detect prompt intent. They must not parse JSON, apply commands, or know React state.
- **Small public API:** Add only two slide-specific methods to `PromptService`: `generateSlideTasksFromPrompt()` and `generateSlideElementFromTask()`. Avoid broad generic LLM helpers until another concrete use case needs them.
- **Fast feedback:** Break the user request into small generated tasks and apply them one-by-one so users see the slide appear progressively: background, image/placeholder/remote image, title, subtitle, bullets, shapes, CTA.
- **Prompt maintainability:** All Prompt API instructions must live in dedicated files under `src/services/prompts/`. Do not bury long prompt strings in `ChromePromptService` or `useEditorViewModel`.

## File Structure

Create these files:

- `src/domain/generatedSlide.ts`: generated slide JSON TypeScript types, Prompt API JSON Schema, runtime validation, value clamping, design constants, and conversion helpers. This is the only file allowed to define generated-slide schema/defaults.
- `src/domain/commands/applyGeneratedSlideCommand.ts`: immutable command helpers that prepare the active page and append generated elements/assets/background without duplicating mapping logic.
- `src/services/prompts/slideTaskPrompt.ts`: deterministic task-breakdown prompt builder for Chrome Prompt API, including EW Academy design constraints, language instructions, remote image URL rules, default layout instructions, and image-generation refusal rule.
- `src/services/prompts/slideElementPrompt.ts`: deterministic per-task prompt builder for Chrome Prompt API, used when a generated task needs a concrete element JSON payload.
- `src/assets/placeholder-image.ts`: exports the imported placeholder image URL and stable asset metadata constants.
- `src/assets/placeholder-web-ai.jpeg`: downloaded placeholder image asset from `https://community.softr.io/uploads/db9110/original/2X/7/74e6e7e382d0ff5d7773ca9a87e6f6f8817a68a6.jpeg`.
- `tests/unit/domain/generatedSlide.test.ts`: validation/clamping tests.
- `tests/unit/domain/commands/applyGeneratedSlideCommand.test.ts`: immutable command tests.
- `tests/unit/services/prompts/slideTaskPrompt.test.ts`: task-breakdown prompt-template tests.
- `tests/unit/services/prompts/slideElementPrompt.test.ts`: per-task element prompt-template tests.
- `tests/unit/services/chromePromptService.slides.test.ts`: Prompt API generation adapter tests.

Modify these existing files:

- `src/services/interfaces.ts`: extend `PromptService` with staged slide-generation methods.
- `src/services/chromePromptService.ts`: create Prompt API sessions, send task-breakdown and element prompts with `responseConstraint`, parse/validate JSON, and return generated tasks progressively.
- `src/app/composition.ts`: no new service instance if `ChromePromptService` remains concrete; update imports only if needed.
- `src/ui/editor/PromptBar.tsx`: add `onSlidePromptSubmit`, keep create-image mode gated, and pass mode/value on submit.
- `src/ui/editor/EditorShell.tsx`: wire prompt submissions into the view model.
- `src/ui/editor/useEditorViewModel.ts`: add prompt-to-slide state, ready checks, image-request tooltip, generated-slide command execution, and placeholder asset use.
- `src/app/styles.css`: add tooltip/status styling for prompt errors and generation progress.
- `tests/unit/ui/editor/aiFlows.test.tsx`: add Prompt API slide-generation UI tests and update `TestPromptService`.
- `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`: update implementation status and Prompt API generation behavior.

Do not modify:

- `src/domain/model.ts` unless a generated-slide type truly cannot map to existing `text`, `image`, and `shape` elements. The MVP should reuse the existing document model.
- `src/services/PaletteService` yet. Palette generation is now part of Prompt API design generation, but this task should not remove the legacy seam.

## Generation Flow

The slide prompt flow is staged for faster feedback:

1. User submits a normal prompt, such as `A slide with a placeholder image on the left, the title Local AI Is Faster in the middle, and subtext below`.
2. `useEditorViewModel` checks whether this is actually an image-generation request. If yes, it shows `Use Create image from the + menu to generate images.` and stops.
3. `PromptService.generateSlideTasksFromPrompt()` asks Prompt API for a small task list with `GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA`.
4. The view model applies tasks incrementally. Each task either maps directly to a command or asks Prompt API for one concrete element payload with `GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA`.
5. The canvas updates after each task: background first, then image/placeholder/remote image, then title, subtitle, body, shapes, CTA.

If the user provides an image URL, use it as a remote image asset. This is not considered image generation. If the user asks for a placeholder image, use the local placeholder asset. If the user asks to generate an image while not in `Create image` mode, show the tooltip and do not generate slide tasks.

If the user does not provide specific positioning, the prompt files instruct Prompt API to choose a polished EW Academy style layout using the current design system and page constraints.

## Generated JSON Contract

Prompt API task breakdown must return JSON matching this shape:

```ts
export interface GeneratedSlideTasksDocument {
  language: string;
  page: {
    name: string;
    width: 1920;
    height: 1080;
    background: { type: 'color'; color: string };
  };
  tasks: GeneratedSlideTask[];
}

export type GeneratedSlideTask =
  | { type: 'set-background'; color: string }
  | { type: 'add-placeholder-image'; id: string; description: string; placementHint: string }
  | { type: 'add-remote-image'; id: string; url: string; description: string; placementHint: string }
  | { type: 'add-title'; id: string; text: string; placementHint: string }
  | { type: 'add-subtitle'; id: string; text: string; placementHint: string }
  | { type: 'add-body-text'; id: string; text: string; placementHint: string }
  | { type: 'add-bullets'; id: string; items: string[]; placementHint: string }
  | { type: 'add-shape'; id: string; shape: 'rect' | 'ellipse'; placementHint: string }
  | { type: 'add-cta'; id: string; text: string; placementHint: string };
}
```

For each task that adds a visual object, Prompt API must return one concrete element JSON payload matching this shape. The implementation must pass the equivalent JSON Schema to `session.prompt(prompt, { responseConstraint })` and still run `parseGeneratedSlideTasksJson()` / `parseGeneratedSlideElementJson()` validation before applying anything to the Konva document model.

```ts
export type GeneratedSlideElement =
  | {
      type: 'text';
      id: string;
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
      fontFamily: 'Orbitron' | 'Open Sans';
      fontSize: number;
      fontWeight: 400 | 600 | 700 | 800 | 900;
      fill: string;
      align: 'left' | 'center' | 'right';
    }
  | {
      type: 'image';
      id: string;
      assetRole: 'placeholder' | 'remote';
      src?: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
    }
  | {
      type: 'shape';
      id: string;
      shape: 'rect' | 'ellipse';
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    };
```

Rules:

- Coordinates are page-space pixels for `1920 x 1080`.
- Generated IDs are local to the generated JSON. The command prefixes them to avoid collisions.
- `assetRole: "placeholder"` maps to the local placeholder image asset.
- `assetRole: "remote"` requires a valid `https://` image URL in `src` and maps to a remote image asset.
- Text must be in the same language requested by the user. If the user prompts in Portuguese, generated text should be Portuguese. If the user explicitly asks for Spanish, generated text should be Spanish.
- If the user asks to generate an image while not in `Create image` mode, do not call Prompt API for a slide. Show a tooltip explaining: `Use Create image from the + menu to generate images.`

## Task 1: Add Placeholder Image Asset

**Files:**
- Create: `src/assets/placeholder-web-ai.jpeg`
- Create: `src/assets/placeholder-image.ts`
- Test: `tests/unit/domain/commands/applyGeneratedSlideCommand.test.ts`

- [x] **Step 1: Download the placeholder image**

Run:

```bash
curl -L "https://community.softr.io/uploads/db9110/original/2X/7/74e6e7e382d0ff5d7773ca9a87e6f6f8817a68a6.jpeg" -o src/assets/placeholder-web-ai.jpeg
```

Expected: file exists at `src/assets/placeholder-web-ai.jpeg`.

- [x] **Step 2: Create placeholder asset constants**

Create `src/assets/placeholder-image.ts`:

```ts
import placeholderImageUrl from './placeholder-web-ai.jpeg';

export const PLACEHOLDER_IMAGE_ASSET_ID = 'asset-placeholder-web-ai';
export const PLACEHOLDER_IMAGE_NAME = 'Web AI placeholder image';
export const PLACEHOLDER_IMAGE_MIME_TYPE = 'image/jpeg';
export const PLACEHOLDER_IMAGE_URL = placeholderImageUrl;
```

- [x] **Step 3: Add image import declaration if needed**

If TypeScript reports missing image module declarations, create or extend `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [x] **Step 4: Verify**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/assets/placeholder-web-ai.jpeg src/assets/placeholder-image.ts src/vite-env.d.ts
git commit -m "Add prompt placeholder image asset"
```

## Task 2: Define Generated Slide Types and Validation

**Files:**
- Create: `src/domain/generatedSlide.ts`
- Test: `tests/unit/domain/generatedSlide.test.ts`

- [x] **Step 1: Write failing validation tests**

Create `tests/unit/domain/generatedSlide.test.ts`:

```ts
import {
  GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA,
  GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA,
  parseGeneratedSlideElementJson,
  parseGeneratedSlideTasksJson,
} from '../../../src/domain/generatedSlide';

describe('generated slide validation', () => {
  it('parses staged slide tasks', () => {
    const result = parseGeneratedSlideTasksJson(JSON.stringify({
      language: 'en',
      page: {
        name: 'Why Web AI Matters',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        { type: 'add-placeholder-image', id: 'visual', description: 'web ai demo', placementHint: 'left side' },
        { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      ],
    }));

    expect(result.page.name).toBe('Why Web AI Matters');
    expect(result.tasks).toHaveLength(3);
  });

  it('parses a remote image task only when the URL is https', () => {
    const result = parseGeneratedSlideTasksJson(JSON.stringify({
      language: 'en',
      page: {
        name: 'Remote image',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        {
          type: 'add-remote-image',
          id: 'visual',
          url: 'https://example.com/photo.jpeg',
          description: 'provided image',
          placementHint: 'left side',
        },
      ],
    }));

    expect(result.tasks[0]).toMatchObject({ type: 'add-remote-image', url: 'https://example.com/photo.jpeg' });
  });

  it('rejects non-https remote image tasks', () => {
    expect(() =>
      parseGeneratedSlideTasksJson(JSON.stringify({
        language: 'en',
        page: {
          name: 'Bad',
          width: 1920,
          height: 1080,
          background: { type: 'color', color: '#050D10' },
        },
        tasks: [
          { type: 'add-remote-image', id: 'bad', url: 'http://example.com/photo.jpeg', description: 'bad', placementHint: 'left' },
        ],
      })),
    ).toThrow('Remote image tasks must use an https URL');
  });

  it('parses and clamps one generated element', () => {
    const result = parseGeneratedSlideElementJson(JSON.stringify({
      type: 'shape',
      id: 'shape',
      shape: 'rect',
      x: -50,
      y: 1000,
      width: 2500,
      height: 500,
      rotation: 0,
      opacity: 1.5,
      fill: 'not-a-color',
    }));

    expect(result).toMatchObject({
      x: 0,
      y: 1000,
      width: 1920,
      height: 80,
      opacity: 1,
      fill: '#37FD76',
    });
  });

  it('exports JSON Schemas compatible with Prompt API responseConstraint', () => {
    expect(GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['language', 'page', 'tasks'],
    });
    expect(GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA).toMatchObject({
      oneOf: expect.any(Array),
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- --run tests/unit/domain/generatedSlide.test.ts
```

Expected: FAIL because `src/domain/generatedSlide.ts` does not exist.

- [x] **Step 3: Implement generated task and element parsing**

Create `src/domain/generatedSlide.ts` with:

- `GeneratedSlideTasksDocument`, `GeneratedSlideTask`, and `GeneratedSlideElement` types.
- `GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA` for the task-breakdown Prompt API call.
- `GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA` for the per-element Prompt API call.
- `parseGeneratedSlideTasksJson(value: string): GeneratedSlideTasksDocument`.
- `parseGeneratedSlideElementJson(value: string): GeneratedSlideElement`.
- Shared helpers for JSON extraction, record/string/number parsing, color normalization, frame clamping, task normalization, and element normalization.

Implementation rules:

- Keep all generated-slide constants in this file: page size, allowed colors/default colors, allowed fonts, allowed font weights, maximum task count, maximum frame bounds.
- `set-background` tasks normalize invalid colors to `#050D10`.
- `add-remote-image` tasks must throw unless `url` starts with `https://`.
- `GeneratedImageElement` supports only `assetRole: 'placeholder' | 'remote'`.
- Remote image elements must throw unless `src` starts with `https://`.
- Text, image, and shape frames clamp inside `1920 x 1080`.
- `extractJson()` should tolerate fenced JSON because Prompt API structured output should be strict, but validation should still be defensive.

- [x] **Step 4: Run tests**

Run:

```bash
npm run test -- --run tests/unit/domain/generatedSlide.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/domain/generatedSlide.ts tests/unit/domain/generatedSlide.test.ts
git commit -m "Add generated slide task validation"
```

## Task 3: Add Generated Slide Commands

**Files:**
- Create: `src/domain/commands/applyGeneratedSlideCommand.ts`
- Modify: `src/domain/commands/basicCommands.ts`
- Test: `tests/unit/domain/commands/applyGeneratedSlideCommand.test.ts`

- [x] **Step 1: Write failing command tests**

Create `tests/unit/domain/commands/applyGeneratedSlideCommand.test.ts`:

```ts
import {
  AddGeneratedSlideElementCommand,
  PrepareGeneratedSlideCommand,
} from '../../../../src/domain/commands/applyGeneratedSlideCommand';
import { createSampleProject } from '../../../../src/domain/sampleProject';

describe('generated slide commands', () => {
  it('prepares the active page by clearing current page elements and applying page metadata', () => {
    const project = createSampleProject();
    const command = new PrepareGeneratedSlideCommand('page-1', {
      name: 'Why Web AI Matters',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#050D10' },
    });

    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.pages[0]).toMatchObject({
      name: 'Why Web AI Matters',
      background: { type: 'color', color: '#050D10' },
    });
    expect(next.pages[0]?.elementIds).toEqual([]);
    expect(project.pages[0]?.elementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
  });

  it('appends a generated placeholder image immutably', () => {
    const project = createSampleProject();
    const prepared = new PrepareGeneratedSlideCommand('page-1', {
      name: 'Why Web AI Matters',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#050D10' },
    }).execute(project);

    const next = new AddGeneratedSlideElementCommand('page-1', {
      type: 'image',
      id: 'visual',
      assetRole: 'placeholder',
      x: 80,
      y: 240,
      width: 720,
      height: 540,
      rotation: 0,
      opacity: 1,
    }).execute(prepared);

    expect(next.pages[0]?.elementIds).toEqual(['generated-page-1-visual']);
    expect(next.assets['asset-placeholder-web-ai']).toMatchObject({
      id: 'asset-placeholder-web-ai',
      type: 'image',
      name: 'Web AI placeholder image',
      mimeType: 'image/jpeg',
    });
    expect(next.elements['generated-page-1-visual']).toMatchObject({
      type: 'image',
      assetId: 'asset-placeholder-web-ai',
      x: 80,
      y: 240,
    });
  });

  it('appends a generated remote image asset when the element has a remote src', () => {
    const project = createSampleProject();
    const prepared = new PrepareGeneratedSlideCommand('page-1', {
      name: 'Remote image',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#050D10' },
    }).execute(project);

    const next = new AddGeneratedSlideElementCommand('page-1', {
      type: 'image',
      id: 'remote',
      assetRole: 'remote',
      src: 'https://example.com/photo.jpeg',
      x: 80,
      y: 240,
      width: 720,
      height: 540,
      rotation: 0,
      opacity: 1,
    }).execute(prepared);

    const image = next.elements['generated-page-1-remote'];
    expect(image).toMatchObject({ type: 'image' });
    expect(next.assets[image.assetId]).toMatchObject({
      type: 'image',
      objectUrl: 'https://example.com/photo.jpeg',
      storage: 'remote',
    });
  });

  it('keeps other pages untouched while preparing one page', () => {
    const project = createSampleProject();
    const projectWithSecondPage = {
      ...project,
      pages: [
        ...project.pages,
        {
          id: 'page-2',
          name: 'Slide 2',
          width: 1920,
          height: 1080,
          background: { type: 'color' as const, color: '#050D10' },
          elementIds: ['text-title'],
        },
      ],
    };

    const next = new PrepareGeneratedSlideCommand('page-2', {
      name: 'IA no navegador',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#000000' },
    }).execute(projectWithSecondPage);

    expect(next.pages[0]?.elementIds).toEqual(project.pages[0]?.elementIds);
    expect(next.pages[1]).toMatchObject({ name: 'IA no navegador', elementIds: [] });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- --run tests/unit/domain/commands/applyGeneratedSlideCommand.test.ts
```

Expected: FAIL because commands do not exist.

- [x] **Step 3: Implement the commands**

Create `src/domain/commands/applyGeneratedSlideCommand.ts`:

```ts
import {
  PLACEHOLDER_IMAGE_ASSET_ID,
  PLACEHOLDER_IMAGE_MIME_TYPE,
  PLACEHOLDER_IMAGE_NAME,
  PLACEHOLDER_IMAGE_URL,
} from '../../assets/placeholder-image';
import type { Asset, DesignElement, ProjectDocument } from '../model';
import type { GeneratedSlideElement, GeneratedSlideTasksDocument } from '../generatedSlide';
import type { EditorCommand } from './types';

function generatedElementId(pageId: string, id: string) {
  return `generated-${pageId}-${id.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}`;
}

function toDesignElement(pageId: string, element: GeneratedSlideElement): DesignElement {
  const base = {
    id: generatedElementId(pageId, element.id),
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    locked: false,
    visible: true,
    opacity: element.opacity,
  };

  if (element.type === 'text') {
    return {
      ...base,
      type: 'text',
      text: element.text,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      fill: element.fill,
      align: element.align,
    };
  }

  if (element.type === 'image') {
    return {
      ...base,
      type: 'image',
      assetId: element.assetRole === 'remote' && element.src ? remoteAssetId(element.src) : PLACEHOLDER_IMAGE_ASSET_ID,
    };
  }

  return {
    ...base,
    type: 'shape',
    shape: element.shape,
    fill: element.fill,
    ...(element.stroke ? { stroke: element.stroke } : {}),
    ...(element.strokeWidth !== undefined ? { strokeWidth: element.strokeWidth } : {}),
  };
}

const placeholderAsset: Asset = {
  id: PLACEHOLDER_IMAGE_ASSET_ID,
  type: 'image',
  name: PLACEHOLDER_IMAGE_NAME,
  mimeType: PLACEHOLDER_IMAGE_MIME_TYPE,
  objectUrl: PLACEHOLDER_IMAGE_URL,
  storage: 'inline',
};

function remoteAssetId(url: string | undefined) {
  return `asset-remote-${btoa(url ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase()}`;
}

function toRemoteAsset(element: GeneratedSlideElement): Asset | undefined {
  if (element.type !== 'image' || element.assetRole !== 'remote' || !element.src) return undefined;
  return {
    id: remoteAssetId(element.src),
    type: 'image',
    name: 'Remote prompt image',
    mimeType: 'image/*',
    objectUrl: element.src,
    storage: 'remote',
  };
}

export class PrepareGeneratedSlideCommand implements EditorCommand {
  readonly description = 'Prepare generated slide';

  constructor(
    private readonly pageId: string,
    private readonly page: GeneratedSlideTasksDocument['page'],
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;

    const oldElementIds = new Set(page.elementIds);
    const remainingElements = Object.fromEntries(
      Object.entries(project.elements).filter(([elementId]) => !oldElementIds.has(elementId)),
    );

    return {
      ...project,
      elements: remainingElements,
      pages: project.pages.map((item) =>
        item.id === this.pageId
          ? {
              ...item,
              name: this.page.name,
              background: this.page.background,
              elementIds: [],
            }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}

export class AddGeneratedSlideElementCommand implements EditorCommand {
  readonly description = 'Add generated slide element';

  constructor(
    private readonly pageId: string,
    private readonly element: GeneratedSlideElement,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;

    const designElement = toDesignElement(this.pageId, this.element);
    const needsPlaceholderAsset = this.element.type === 'image' && this.element.assetRole === 'placeholder';
    const remoteAsset = toRemoteAsset(this.element);

    return {
      ...project,
      assets: {
        ...project.assets,
        ...(needsPlaceholderAsset ? { [PLACEHOLDER_IMAGE_ASSET_ID]: placeholderAsset } : {}),
        ...(remoteAsset ? { [remoteAsset.id]: remoteAsset } : {}),
      },
      elements: {
        ...project.elements,
        [designElement.id]: designElement,
      },
      pages: project.pages.map((item) =>
        item.id === this.pageId
          ? {
              ...item,
              elementIds: [...item.elementIds.filter((elementId) => elementId !== designElement.id), designElement.id],
            }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}
```

- [x] **Step 4: Export commands from basic command barrel if needed**

If imports are centralized later, add this to `src/domain/commands/basicCommands.ts`:

```ts
export {
  AddGeneratedSlideElementCommand,
  PrepareGeneratedSlideCommand,
} from './applyGeneratedSlideCommand';
```

If that creates an import cycle, skip this step and import from `applyGeneratedSlideCommand` directly in the view model.

- [x] **Step 5: Run tests**

Run:

```bash
npm run test -- --run tests/unit/domain/commands/applyGeneratedSlideCommand.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/domain/commands/applyGeneratedSlideCommand.ts src/domain/commands/basicCommands.ts tests/unit/domain/commands/applyGeneratedSlideCommand.test.ts
git commit -m "Add generated slide commands"
```

## Task 4: Build Dedicated Prompt Files

**Files:**
- Create: `src/services/prompts/slideTaskPrompt.ts`
- Create: `src/services/prompts/slideElementPrompt.ts`
- Test: `tests/unit/services/prompts/slideTaskPrompt.test.ts`
- Test: `tests/unit/services/prompts/slideElementPrompt.test.ts`

- [x] **Step 1: Write failing task-prompt tests**

Create `tests/unit/services/prompts/slideTaskPrompt.test.ts`:

```ts
import {
  buildSlideTaskPrompt,
  extractImageUrls,
  looksLikeImageGenerationRequest,
} from '../../../../src/services/prompts/slideTaskPrompt';

describe('slide task prompt', () => {
  it('asks Prompt API for a staged task list using the design system', () => {
    const prompt = buildSlideTaskPrompt({
      userPrompt: 'A slide with the title Why Web AI Matters',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('Return JSON that matches the provided response schema');
    expect(prompt).toContain('small ordered task list');
    expect(prompt).toContain('set-background');
    expect(prompt).toContain('add-title');
    expect(prompt).toContain('1920');
    expect(prompt).toContain('1080');
    expect(prompt).toContain('#37FD76');
    expect(prompt).toContain('Orbitron');
    expect(prompt).toContain('Open Sans');
    expect(prompt).toContain('A slide with the title Why Web AI Matters');
  });

  it('tells Prompt API to preserve the requested language', () => {
    const prompt = buildSlideTaskPrompt({
      userPrompt: 'Um slide em português sobre IA no navegador',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('Generate all visible text in the language requested by the user');
    expect(prompt).toContain('Um slide em português sobre IA no navegador');
  });

  it('allows remote image URLs without treating them as image generation', () => {
    const prompt = 'A slide using https://example.com/photo.jpeg as the main image';

    expect(extractImageUrls(prompt)).toEqual(['https://example.com/photo.jpeg']);
    expect(looksLikeImageGenerationRequest(prompt)).toBe(false);
  });

  it('detects image generation requests that should use Create image mode', () => {
    expect(looksLikeImageGenerationRequest('generate an image of a futuristic browser')).toBe(true);
    expect(looksLikeImageGenerationRequest('crie uma imagem de uma árvore congelada')).toBe(true);
    expect(looksLikeImageGenerationRequest('a slide with a placeholder image on the left')).toBe(false);
  });
});
```

- [x] **Step 2: Write failing element-prompt tests**

Create `tests/unit/services/prompts/slideElementPrompt.test.ts`:

```ts
import { buildSlideElementPrompt } from '../../../../src/services/prompts/slideElementPrompt';

describe('slide element prompt', () => {
  it('asks for exactly one concrete Konva-ready element', () => {
    const prompt = buildSlideElementPrompt({
      task: {
        type: 'add-title',
        id: 'title',
        text: 'Why Web AI Matters',
        placementHint: 'right side, centered vertically',
      },
      page: {
        name: 'Generated slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      existingElements: [],
    });

    expect(prompt).toContain('Return one JSON element matching the provided response schema');
    expect(prompt).toContain('add-title');
    expect(prompt).toContain('right side, centered vertically');
    expect(prompt).toContain('Keep the element inside 1920 x 1080');
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test -- --run tests/unit/services/prompts/slideTaskPrompt.test.ts tests/unit/services/prompts/slideElementPrompt.test.ts
```

Expected: FAIL because the prompt files do not exist.

- [x] **Step 4: Implement `slideTaskPrompt.ts`**

Create `src/services/prompts/slideTaskPrompt.ts`:

```ts
interface BuildSlideTaskPromptOptions {
  userPrompt: string;
  targetLanguageHint: string;
  imageUrls: string[];
}

const IMAGE_URL_PATTERN = /https:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>]*)?/gi;

const IMAGE_GENERATION_PATTERNS = [
  /\bgenerate an image\b/i,
  /\bcreate an image\b/i,
  /\bmake an image\b/i,
  /\bimage of\b/i,
  /\bphoto realistic\b/i,
  /\bcrie uma imagem\b/i,
  /\bgerar uma imagem\b/i,
  /\bcrear una imagen\b/i,
  /\bgenera una imagen\b/i,
];

export function extractImageUrls(prompt: string) {
  return Array.from(new Set(prompt.match(IMAGE_URL_PATTERN) ?? []));
}

export function looksLikeImageGenerationRequest(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return false;
  if (extractImageUrls(normalized).length > 0) return false;
  if (/\bplaceholder image\b/i.test(normalized)) return false;
  if (/\bimagem placeholder\b/i.test(normalized)) return false;
  return IMAGE_GENERATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildSlideTaskPrompt(options: BuildSlideTaskPromptOptions) {
  return [
    'You are LocalStudio.ai, a browser-only slide planning engine.',
    'Return JSON that matches the provided response schema. Do not use markdown. Do not explain your answer.',
    'Create a small ordered task list so the editor can render the slide progressively.',
    'Generate all visible text in the language requested by the user. If the user does not specify a language, use the same language as the user prompt.',
    `Target language hint: ${options.targetLanguageHint}.`,
    '',
    'Allowed task types:',
    '- set-background',
    '- add-placeholder-image',
    '- add-remote-image',
    '- add-title',
    '- add-subtitle',
    '- add-body-text',
    '- add-bullets',
    '- add-shape',
    '- add-cta',
    '',
    'Canvas:',
    '- width: 1920',
    '- height: 1080',
    '- coordinates are decided later by the element prompt',
    '- if the user gives no position, choose a polished EW Academy / LocalStudio.ai layout',
    '',
    'Visual system:',
    '- dark background: #050D10 or #000000',
    '- primary green: #37FD76',
    '- white text: #FFFFFF',
    '- muted text: #91999D',
    '- use Orbitron for titles and key labels',
    '- use Open Sans for readable subtitles, bullets, and body copy',
    '',
    'Images:',
    '- If the user asks for a placeholder image, create an add-placeholder-image task.',
    '- If the user provides an https image URL, create an add-remote-image task using that exact URL.',
    '- Do not invent image URLs.',
    '- If the user asks to generate a new image, the UI will block before this prompt runs.',
    options.imageUrls.length > 0 ? `Known image URLs: ${options.imageUrls.join(', ')}` : 'Known image URLs: none',
    '',
    `User prompt: ${options.userPrompt}`,
  ].join('\n');
}
```

- [x] **Step 5: Implement `slideElementPrompt.ts`**

Create `src/services/prompts/slideElementPrompt.ts`:

```ts
import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../../domain/generatedSlide';

interface BuildSlideElementPromptOptions {
  task: Exclude<GeneratedSlideTask, { type: 'set-background' }>;
  page: GeneratedSlideTasksDocument['page'];
  existingElements: GeneratedSlideElement[];
}

export function buildSlideElementPrompt(options: BuildSlideElementPromptOptions) {
  return [
    'You are LocalStudio.ai, a browser-only Konva element layout engine.',
    'Return one JSON element matching the provided response schema. Do not use markdown. Do not explain your answer.',
    `Keep the element inside ${options.page.width} x ${options.page.height}.`,
    'Use page-space pixels. Preserve the requested task text exactly unless typography requires line breaks.',
    'Use Orbitron for title/key text and Open Sans for readable secondary text.',
    'Avoid overlapping existing elements unless the task explicitly asks for overlay composition.',
    '',
    `Page: ${JSON.stringify(options.page)}`,
    `Existing elements: ${JSON.stringify(options.existingElements)}`,
    `Task: ${JSON.stringify(options.task)}`,
  ].join('\n');
}
```

- [x] **Step 6: Run tests**

Run:

```bash
npm run test -- --run tests/unit/services/prompts/slideTaskPrompt.test.ts tests/unit/services/prompts/slideElementPrompt.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/services/prompts/slideTaskPrompt.ts src/services/prompts/slideElementPrompt.ts tests/unit/services/prompts/slideTaskPrompt.test.ts tests/unit/services/prompts/slideElementPrompt.test.ts
git commit -m "Add Prompt API slide prompt files"
```

## Task 5: Extend PromptService for Staged Slide Generation

**Files:**
- Modify: `src/services/interfaces.ts`
- Modify: `src/services/chromePromptService.ts`
- Test: `tests/unit/services/chromePromptService.slides.test.ts`

- [x] **Step 1: Write failing ChromePromptService tests**

Create `tests/unit/services/chromePromptService.slides.test.ts`:

```ts
import { ChromePromptService } from '../../../src/services/chromePromptService';

describe('ChromePromptService slide generation', () => {
  afterEach(() => {
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: undefined,
    });
  });

  it('generates validated slide tasks with Prompt API structured output', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify({
      language: 'en',
      page: {
        name: 'Why Web AI Matters',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      ],
    }));
    const destroy = vi.fn();
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({ prompt, destroy }),
      },
    });

    const service = new ChromePromptService();
    const tasks = await service.generateSlideTasksFromPrompt('A slide about Web AI');

    expect(tasks.page.name).toBe('Why Web AI Matters');
    expect(tasks.tasks).toHaveLength(2);
    expect(prompt.mock.calls[0]?.[0]).toContain('small ordered task list');
    expect(prompt.mock.calls[0]?.[1]).toMatchObject({
      responseConstraint: expect.objectContaining({ type: 'object' }),
    });
    expect(destroy).toHaveBeenCalled();
  });

  it('generates one validated element for a task', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify({
      type: 'text',
      id: 'title',
      text: 'Why Web AI Matters',
      x: 960,
      y: 310,
      width: 760,
      height: 160,
      rotation: 0,
      opacity: 1,
      fontFamily: 'Orbitron',
      fontSize: 76,
      fontWeight: 800,
      fill: '#37FD76',
      align: 'center',
    }));
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
      },
    });

    const service = new ChromePromptService();
    const element = await service.generateSlideElementFromTask(
      { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      {
        page: {
          name: 'Generated slide',
          width: 1920,
          height: 1080,
          background: { type: 'color', color: '#050D10' },
        },
        existingElements: [],
      },
    );

    expect(element).toMatchObject({ type: 'text', text: 'Why Web AI Matters' });
    expect(prompt.mock.calls[0]?.[0]).toContain('Return one JSON element');
    expect(prompt.mock.calls[0]?.[1]).toMatchObject({
      responseConstraint: expect.objectContaining({ type: 'object' }),
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- --run tests/unit/services/chromePromptService.slides.test.ts
```

Expected: FAIL because the staged slide-generation methods are not on `PromptService`.

- [x] **Step 3: Extend interfaces**

Modify `src/services/interfaces.ts`:

```ts
import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../domain/generatedSlide';
```

Then update:

```ts
export interface PromptService {
  checkAvailability(): Promise<PromptApiAvailability>;
  preparePromptApi(options?: { onProgress?: (progress: number) => void }): Promise<void>;
  generateSlideTasksFromPrompt(
    prompt: string,
    options?: { targetLanguageHint?: string },
  ): Promise<GeneratedSlideTasksDocument>;
  generateSlideElementFromTask(
    task: Exclude<GeneratedSlideTask, { type: 'set-background' }>,
    context: {
      page: GeneratedSlideTasksDocument['page'];
      existingElements: GeneratedSlideElement[];
    },
  ): Promise<GeneratedSlideElement>;
}
```

- [x] **Step 4: Implement ChromePromptService staged methods**

Modify `src/services/chromePromptService.ts`:

```ts
import {
  GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA,
  GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA,
  parseGeneratedSlideElementJson,
  parseGeneratedSlideTasksJson,
  type GeneratedSlideElement,
  type GeneratedSlideTask,
  type GeneratedSlideTasksDocument,
} from '../domain/generatedSlide';
import { buildSlideElementPrompt } from './prompts/slideElementPrompt';
import { buildSlideTaskPrompt, extractImageUrls } from './prompts/slideTaskPrompt';
```

Update `ChromePromptSession`:

```ts
interface ChromePromptSession {
  destroy?: () => void;
  prompt?: (input: string, options?: { responseConstraint?: unknown }) => Promise<string>;
}
```

Add methods to `ChromePromptService`:

```ts
async generateSlideTasksFromPrompt(
  prompt: string,
  options: { targetLanguageHint?: string } = {},
): Promise<GeneratedSlideTasksDocument> {
  const response = await this.promptWithStructuredOutput(
    buildSlideTaskPrompt({
      userPrompt: prompt,
      targetLanguageHint: options.targetLanguageHint ?? 'same as user prompt',
      imageUrls: extractImageUrls(prompt),
    }),
    GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA,
  );
  this.ready = true;
  return parseGeneratedSlideTasksJson(response);
}

async generateSlideElementFromTask(
  task: Exclude<GeneratedSlideTask, { type: 'set-background' }>,
  context: {
    page: GeneratedSlideTasksDocument['page'];
    existingElements: GeneratedSlideElement[];
  },
): Promise<GeneratedSlideElement> {
  const response = await this.promptWithStructuredOutput(
    buildSlideElementPrompt({ task, page: context.page, existingElements: context.existingElements }),
    GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA,
  );
  this.ready = true;
  return parseGeneratedSlideElementJson(response);
}

private async promptWithStructuredOutput(prompt: string, responseConstraint: unknown) {
  const languageModel = getLanguageModelApi();
  if (!languageModel?.create) throw new Error('Chrome Prompt API is unavailable.');

  const session = await languageModel.create();
  try {
    if (!session.prompt) throw new Error('Chrome Prompt API session cannot generate text.');
    return await session.prompt(prompt, { responseConstraint });
  } finally {
    session.destroy?.();
  }
}
```

This uses Chrome's native structured JSON output as the primary output contract and still validates/clamps the returned JSON before it reaches editor state.

- [x] **Step 5: Run tests**

Run:

```bash
npm run test -- --run tests/unit/services/chromePromptService.slides.test.ts tests/unit/domain/generatedSlide.test.ts tests/unit/services/prompts/slideTaskPrompt.test.ts tests/unit/services/prompts/slideElementPrompt.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/services/interfaces.ts src/services/chromePromptService.ts tests/unit/services/chromePromptService.slides.test.ts
git commit -m "Wire staged Prompt API slide generation service"
```

## Task 6: Wire PromptBar Progressive Slide Submissions

**Files:**
- Modify: `src/domain/commands/applyGeneratedSlideCommand.ts`
- Modify: `src/ui/editor/PromptBar.tsx`
- Modify: `src/ui/editor/EditorShell.tsx`
- Modify: `src/ui/editor/useEditorViewModel.ts`
- Modify: `src/app/styles.css`
- Test: `tests/unit/ui/editor/aiFlows.test.tsx`

- [x] **Step 1: Add command helpers for progressive application**

Extend `src/domain/commands/applyGeneratedSlideCommand.ts` or split into a focused file if it becomes clearer:

```ts
export class PrepareGeneratedSlideCommand implements EditorCommand {
  readonly description = 'Prepare generated slide';

  constructor(
    private readonly pageId: string,
    private readonly page: GeneratedSlideTasksDocument['page'],
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;
    const oldElementIds = new Set(page.elementIds);

    return {
      ...project,
      elements: Object.fromEntries(
        Object.entries(project.elements).filter(([elementId]) => !oldElementIds.has(elementId)),
      ),
      pages: project.pages.map((item) =>
        item.id === this.pageId
          ? { ...item, name: this.page.name, background: this.page.background, elementIds: [] }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}

export class AddGeneratedSlideElementCommand implements EditorCommand {
  readonly description = 'Add generated slide element';

  constructor(
    private readonly pageId: string,
    private readonly element: GeneratedSlideElement,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    // Reuse the same toDesignElement(), placeholder asset, and remote asset helpers from Task 3.
    // Append the mapped element id to page.elementIds without mutating existing arrays.
  }
}
```

Keep the mapping helpers shared in this file so progressive generation and any future full-slide command do not duplicate asset/element conversion logic.

- [x] **Step 2: Update TestPromptService in AI flow tests**

Modify `tests/unit/ui/editor/aiFlows.test.tsx` imports:

```ts
import type {
  GeneratedSlideElement,
  GeneratedSlideTask,
  GeneratedSlideTasksDocument,
} from '../../../../src/domain/generatedSlide';
import type { PromptApiAvailability, PromptService, TranslatorService } from '../../../../src/services/interfaces';
```

Update `TestPromptService`:

```ts
class TestPromptService implements PromptService {
  constructor(private availability: PromptApiAvailability = 'unavailable') {}

  checkAvailability = vi.fn(() => Promise.resolve(this.availability));

  preparePromptApi = vi.fn((options?: { onProgress?: (progress: number) => void }) => {
    options?.onProgress?.(35);
    options?.onProgress?.(100);
    this.availability = 'ready';
    return Promise.resolve();
  });

  generateSlideTasksFromPrompt = vi.fn((): Promise<GeneratedSlideTasksDocument> => {
    this.availability = 'ready';
    return Promise.resolve({
      language: 'en',
      page: {
        name: 'Generated Web AI Slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      ],
    });
  });

  generateSlideElementFromTask = vi.fn(
    (task: Exclude<GeneratedSlideTask, { type: 'set-background' }>): Promise<GeneratedSlideElement> =>
      Promise.resolve({
        type: 'text',
        id: task.id,
        text: 'text' in task ? task.text : 'Why Web AI Matters',
        x: 960,
        y: 280,
        width: 760,
        height: 160,
        rotation: 0,
        opacity: 1,
        fontFamily: 'Orbitron',
        fontSize: 76,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      }),
  );
}
```

- [x] **Step 3: Add failing UI tests**

Append to `tests/unit/ui/editor/aiFlows.test.tsx`:

```ts
it('generates a slide progressively from the default prompt bar mode', async () => {
  const user = userEvent.setup();
  const services = createAppServices();
  const promptService = new TestPromptService('ready');
  services.promptService = promptService;
  render(<EditorShell services={services} />);

  await user.click(
    screen.getByRole('button', {
      name: 'A slide with the title Why Web AI Matters and a subtitle about private AI running in the browser',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

  expect(promptService.generateSlideTasksFromPrompt).toHaveBeenCalledWith(
    'A slide with the title Why Web AI Matters and a subtitle about private AI running in the browser',
    expect.any(Object),
  );
  expect(promptService.generateSlideElementFromTask).toHaveBeenCalled();
  expect(await screen.findByText('Generated Web AI Slide')).toBeInTheDocument();
  expect(screen.getByText('Why Web AI Matters')).toBeInTheDocument();
});

it('shows a tooltip when image generation is requested outside Create image mode', async () => {
  const user = userEvent.setup();
  const services = createAppServices();
  const promptService = new TestPromptService('ready');
  services.promptService = promptService;
  render(<EditorShell services={services} />);

  await user.type(screen.getByRole('textbox', { name: 'Slide structure prompt' }), 'generate an image of a frozen tree');
  await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

  expect(promptService.generateSlideTasksFromPrompt).not.toHaveBeenCalled();
  expect(screen.getByText('Use Create image from the + menu to generate images.')).toBeInTheDocument();
});
```

- [x] **Step 4: Run tests to verify failure**

Run:

```bash
npm run test -- --run tests/unit/ui/editor/aiFlows.test.tsx
```

Expected: FAIL because prompt submissions are not wired yet.

- [x] **Step 5: Update PromptBar props and submit behavior**

Modify `src/ui/editor/PromptBar.tsx`:

```ts
interface PromptBarProps {
  generationNotice?: string | undefined;
  generationStatus?: string | undefined;
  isGeneratingSlide?: boolean;
  onCreateImagePromptIntent?: () => Promise<boolean>;
  onSlidePromptSubmit?: (prompt: string) => Promise<void>;
}
```

When the user clears the input, reset `create-image` mode back to normal slide mode so the examples return to slide-generation examples.

Add submit helper:

```ts
async function submitPrompt() {
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  if (mode === 'create-image') {
    await guardPromptIntent();
    return;
  }
  await onSlidePromptSubmit?.(trimmedValue);
}
```

Render `generationStatus` and `generationNotice` above the form:

```tsx
{generationStatus ? <div className="prompt-generation-status">{generationStatus}</div> : null}
{generationNotice ? (
  <div className="prompt-generation-notice" role="tooltip">
    {generationNotice}
  </div>
) : null}
```

- [x] **Step 6: Wire EditorShell**

Modify `src/ui/editor/EditorShell.tsx`:

```tsx
<PromptBar
  generationNotice={vm.promptGenerationNotice}
  generationStatus={vm.promptGenerationStatus}
  isGeneratingSlide={vm.isGeneratingSlide}
  onCreateImagePromptIntent={() => vm.ensurePromptApiReadyForPrompt()}
  onSlidePromptSubmit={(prompt) => vm.generateSlideFromPrompt(prompt)}
/>
```

- [x] **Step 7: Add view-model progressive generation behavior**

Modify `src/ui/editor/useEditorViewModel.ts`.

Import:

```ts
import {
  AddGeneratedSlideElementCommand,
  PrepareGeneratedSlideCommand,
} from '../../domain/commands/applyGeneratedSlideCommand';
import { looksLikeImageGenerationRequest } from '../../services/prompts/slideTaskPrompt';
```

Add constants:

```ts
const IMAGE_PROMPT_MODE_REQUIRED_MESSAGE = 'Use Create image from the + menu to generate images.';
```

Add state near Prompt API state:

```ts
const [promptGenerationNotice, setPromptGenerationNotice] = useState<string | undefined>();
const [promptGenerationStatus, setPromptGenerationStatus] = useState<string | undefined>();
const [isGeneratingSlide, setIsGeneratingSlide] = useState(false);
```

Add function:

```ts
async function generateSlideFromPrompt(prompt: string) {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt || isGeneratingSlide) return;

  if (looksLikeImageGenerationRequest(trimmedPrompt)) {
    setPromptGenerationNotice(IMAGE_PROMPT_MODE_REQUIRED_MESSAGE);
    return;
  }

  const isReady = await ensurePromptApiReadyForPrompt();
  if (!isReady) return;

  setPromptGenerationNotice(undefined);
  setIsGeneratingSlide(true);
  try {
    setPromptGenerationStatus('Planning slide...');
    const generatedTasks = await services.promptService.generateSlideTasksFromPrompt(trimmedPrompt, {
      targetLanguageHint: 'same as user prompt',
    });

    commitProject((currentProject) => new PrepareGeneratedSlideCommand(activePageId, generatedTasks.page).execute(currentProject), {
      activePageId,
      selectedElementIds: [],
    });

    const generatedElements: GeneratedSlideElement[] = [];
    for (const task of generatedTasks.tasks) {
      if (task.type === 'set-background') continue;
      setPromptGenerationStatus(`Adding ${task.type.replace('add-', '').replace('-', ' ')}...`);
      const element = await services.promptService.generateSlideElementFromTask(task, {
        page: generatedTasks.page,
        existingElements: generatedElements,
      });
      generatedElements.push(element);
      commitProject((currentProject) => new AddGeneratedSlideElementCommand(activePageId, element).execute(currentProject), {
        activePageId,
        selectedElementIds: [element.id],
      });
    }
  } catch (error) {
    setPromptGenerationNotice(error instanceof Error ? error.message : 'Prompt API could not generate the slide.');
  } finally {
    setPromptGenerationStatus(undefined);
    setIsGeneratingSlide(false);
  }
}
```

Return:

```ts
generateSlideFromPrompt,
promptGenerationNotice,
promptGenerationStatus,
isGeneratingSlide,
```

- [x] **Step 8: Add styles**

Add styles in `src/app/styles.css`:

```css
.prompt-generation-status,
.prompt-generation-notice {
  justify-self: center;
  max-width: min(720px, 100%);
  border: 1px solid rgba(55, 253, 118, 0.34);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.86);
  color: var(--ew-green);
  padding: 7px 12px;
  font-size: 12px;
  box-shadow: 0 0 18px rgba(55, 253, 118, 0.14);
}
```

- [x] **Step 9: Run tests**

Run:

```bash
npm run test -- --run tests/unit/ui/editor/aiFlows.test.tsx
```

Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add src/domain/commands/applyGeneratedSlideCommand.ts src/ui/editor/PromptBar.tsx src/ui/editor/EditorShell.tsx src/ui/editor/useEditorViewModel.ts src/app/styles.css tests/unit/ui/editor/aiFlows.test.tsx
git commit -m "Wire progressive prompt bar slide generation"
```

## Task 7: Update Spec and Run Full Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`
- Modify: `docs/superpowers/plans/2026-06-25-storage-setup-translation.md`

- [x] **Step 1: Update spec status**

In `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`, add under `Ready now`:

```md
- Prompt API slide generation is wired from the main prompt bar. The app builds a strict JSON prompt, validates the model response, applies generated elements through an immutable command, and uses a local placeholder image asset when the prompt asks for placeholder imagery.
```

In `Known limitations`, add:

```md
- Prompt API slide generation currently updates the active page only. Multi-slide deck generation, schema repair retries, and image generation remain future work.
```

- [x] **Step 2: Update active plan checklist**

In `docs/superpowers/plans/2026-06-25-storage-setup-translation.md`, update AI roadmap:

```md
- [x] Build first Prompt API prompt-to-slide generation for the active page using validated JSON and immutable Konva document updates.
- [x] Expand Prompt API generation to multi-slide deck creation.
- [x] Add schema repair retry when Chrome Prompt API returns invalid JSON.
```

- [x] **Step 3: Run full non-Playwright verification**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all PASS. Build may show the existing Vite large chunk warning.

- [x] **Step 4: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md docs/superpowers/plans/2026-06-25-storage-setup-translation.md
git commit -m "Update Prompt API slide generation docs"
```

## Self-Review

Spec coverage:

- Strict Prompt API JSON: covered by Tasks 2, 4, and 5.
- Konva-ready positioning and design instructions: covered by Tasks 2 and 4.
- Placeholder image asset: covered by Tasks 1 and 3.
- Image-generation request outside `Create image` mode shows guidance: covered by Tasks 4 and 6.
- User language preservation: covered by Task 4 prompt instructions and Task 5 service call options.
- Immutable document updates: covered by Task 3 command and Task 6 integration.
- Tests: covered in every implementation task.
- Docs/spec updates: covered by Task 7.
- SOLID/KISS/immutability/no-duplication constraints: covered by the file boundaries, `PromptService` dependency injection, generated slide commands, and single-source `generatedSlide.ts` schema/validation.

Placeholder scan:

- No `TBD`, `TODO`, or vague “handle edge cases” instructions remain.
- Every code-producing step includes concrete code.
- Every test task includes exact assertions and commands.

Type consistency:

- `GeneratedSlideTasksDocument`, `GeneratedSlideTask`, and `GeneratedSlideElement` are defined in Task 2 and used consistently in Tasks 3, 5, and 6.
- `generateSlideTasksFromPrompt` and `generateSlideElementFromTask` are added to `PromptService` in Task 5 and used in Task 6.
- `PrepareGeneratedSlideCommand` receives `pageId` plus generated page metadata, and `AddGeneratedSlideElementCommand` receives `pageId` plus one `GeneratedSlideElement`.

Duplication check before implementation completion:

- `GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA` and `GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA` appear only in `src/domain/generatedSlide.ts` and import sites.
- `#37FD76`, `#050D10`, `Orbitron`, and `Open Sans` generated-slide defaults are defined once in `src/domain/generatedSlide.ts`; prompt text may mention them as instructions but must not redefine validation/default logic.
- Frame clamping appears only in `src/domain/generatedSlide.ts`; command code trusts already-validated generated elements and only maps them to `DesignElement`.
- Placeholder asset constants appear only in `src/assets/placeholder-image.ts`; command code imports them.
