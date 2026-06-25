# Storage, First-Run Setup, and Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden LocalStudio.ai project storage, add a first-run local setup gate, and wire Chrome Built-in AI translation for selected text, current slide, and full deck flows.

**Architecture:** Keep the editor local-only and service-driven. Persistence remains behind `ProjectRepository`, asset file handling becomes part of the File System Access repository, setup readiness lives behind explicit setup/model services, and translation uses `TranslatorService` plus immutable command updates from `useEditorViewModel`.

**Tech Stack:** React, TypeScript strict mode, Vite, Vitest, Testing Library, File System Access API, Chrome Built-in AI browser APIs, existing command/view-model/service patterns.

**Execution Branch:** User explicitly approved implementing on `main` for this pass.

---

## References

- Spec: `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`
- Existing MVP plan: `docs/superpowers/plans/2026-06-24-canva-web-ai-clone-mvp.md`
- File System repository: `src/services/browserFileSystemProjectRepository.ts`
- Editor orchestration: `src/ui/editor/useEditorViewModel.ts`
- Toolbar menu: `src/ui/editor/TopToolbar.tsx`
- Floating selection toolbar: `src/ui/editor/FloatingSelectionToolbar.tsx`
- AI tools panel: `src/ui/editor/AiToolsPanel.tsx`

## File Structure

Modify these existing files:

- `src/domain/model.ts`: add persistent asset metadata fields while preserving `objectUrl` for render-time object/data URLs.
- `src/domain/commands/basicCommands.ts`: add `TranslateTextElementsCommand` for selected text, slide, and deck translation updates.
- `src/services/interfaces.ts`: extend repository/model setup/translation contracts for asset persistence, setup readiness, and translation availability.
- `src/services/browserFileSystemProjectRepository.ts`: move data URL image assets into `assets/`, remove embedded data URLs from saved `project.json`, and hydrate file assets on load.
- `src/services/inMemoryAiServices.ts`: keep deterministic test translator behavior.
- `src/services/modelSetupService.ts`: expose setup/capability state for Chrome translation and local storage readiness.
- `src/app/composition.ts`: wire concrete setup and translation services.
- `src/ui/editor/useEditorViewModel.ts`: add setup state, translation actions, and command integration.
- `src/ui/editor/EditorShell.tsx`: pass setup/translation props to toolbar, floating toolbar, canvas/slide controls, and panels.
- `src/ui/editor/TopToolbar.tsx`: add `Edit > Translate Deck`.
- `src/ui/editor/FloatingSelectionToolbar.tsx`: wire selected-text translate action only for selected text elements.
- `src/ui/editor/CanvasWorkspace.tsx`: expose a current-slide translate icon near slide controls.
- `src/ui/editor/AiToolsPanel.tsx`: show setup readiness/capability states.
- `src/App.tsx`: gate editor rendering behind first-run setup readiness when required.
- `src/app/styles.css`: add minimal Stitch-consistent setup and translate-control styling.
- `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`: update implementation status after tasks complete.

Create these files:

- `src/services/chromeTranslatorService.ts`: Chrome Built-in AI adapter with safe capability checks and deterministic fallback behavior only through tests/mocks.
- `src/services/localSetupService.ts`: browser capability service for File System Access, Chrome translation, and provider readiness metadata.
- `src/ui/setup/FirstRunSetupScreen.tsx`: blocking setup screen.
- `tests/unit/domain/commands/translateTextElementsCommand.test.ts`
- `tests/unit/services/browserFileSystemProjectRepository.assets.test.ts`
- `tests/unit/services/chromeTranslatorService.test.ts`
- `tests/unit/services/localSetupService.test.ts`
- `tests/unit/ui/setup/FirstRunSetupScreen.test.tsx`

## Task 1: Persist Image Assets as Files

**Files:**
- Modify: `src/domain/model.ts`
- Modify: `src/services/browserFileSystemProjectRepository.ts`
- Test: `tests/unit/services/browserFileSystemProjectRepository.assets.test.ts`

- [x] **Step 1: Write the failing asset persistence test**

Create `tests/unit/services/browserFileSystemProjectRepository.assets.test.ts` with this test harness and assertions:

```ts
import { createSampleProject } from '../../../src/domain/sampleProject';
import {
  BrowserFileSystemProjectRepository,
  type RecentProjectHandleStore,
} from '../../../src/services/browserFileSystemProjectRepository';

class MockWritable {
  constructor(private readonly onClose: (value: string | Blob) => void) {}
  private value: string | Blob = '';
  write(value: string | Blob): Promise<void> {
    this.value = value;
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.onClose(this.value);
    return Promise.resolve();
  }
}

class MockFileHandle {
  constructor(
    private readonly name: string,
    private readonly files: Map<string, string | Blob>,
  ) {}
  createWritable(): Promise<MockWritable> {
    return Promise.resolve(new MockWritable((value) => this.files.set(this.name, value)));
  }
  getFile(): Promise<{ text: () => Promise<string>; type: string }> {
    const value = this.files.get(this.name);
    if (value === undefined) return Promise.reject(new DOMException('Not found', 'NotFoundError'));
    if (typeof value === 'string') return Promise.resolve({ text: () => Promise.resolve(value), type: 'application/json' });
    return Promise.resolve({ text: () => value.text(), type: value.type });
  }
}

class MockDirectoryHandle {
  readonly files = new Map<string, string | Blob>();
  readonly directories = new Map<string, MockDirectoryHandle>();
  getFileHandle(name: string, options?: { create?: boolean }): Promise<MockFileHandle> {
    if (!options?.create && !this.files.has(name)) throw new DOMException('Not found', 'NotFoundError');
    return Promise.resolve(new MockFileHandle(name, this.files));
  }
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MockDirectoryHandle> {
    if (!this.directories.has(name)) {
      if (!options?.create) throw new DOMException('Not found', 'NotFoundError');
      this.directories.set(name, new MockDirectoryHandle());
    }
    return Promise.resolve(this.directories.get(name)!);
  }
  queryPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }
  requestPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }
}

class MemoryRecentProjectHandleStore implements RecentProjectHandleStore {
  handle: FileSystemDirectoryHandle | null = null;
  load(): Promise<FileSystemDirectoryHandle | null> {
    return Promise.resolve(this.handle);
  }
  save(handle: FileSystemDirectoryHandle): Promise<void> {
    this.handle = handle;
    return Promise.resolve();
  }
}

describe('BrowserFileSystemProjectRepository asset files', () => {
  it('moves data URL image assets into assets/ and saves metadata in project.json', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = createSampleProject();
    project.assets['asset-hero'] = {
      ...project.assets['asset-hero']!,
      objectUrl: 'data:image/png;base64,aGVsbG8=',
    };

    await repository.saveProject(project);

    const assetsDirectory = directory.directories.get('assets')!;
    expect(assetsDirectory.files.has('asset-hero.png')).toBe(true);
    const savedProject = JSON.parse(directory.files.get('project.json') as string);
    expect(savedProject.assets['asset-hero']).toMatchObject({
      id: 'asset-hero',
      fileName: 'asset-hero.png',
      storage: 'file',
    });
    expect(savedProject.assets['asset-hero'].objectUrl).toBeUndefined();
  });
});
```

- [x] **Step 2: Run the failing test**

Run:

```bash
npm run test -- --run tests/unit/services/browserFileSystemProjectRepository.assets.test.ts
```

Expected: FAIL because `fileName`/`storage` are not written and assets are not moved into `assets/`.

- [x] **Step 3: Add persistent asset metadata**

Modify `src/domain/model.ts`:

```ts
export interface Asset {
  id: string;
  type: 'image';
  name: string;
  mimeType: string;
  objectUrl?: string;
  fileName?: string;
  storage?: 'inline' | 'file' | 'remote';
}
```

- [x] **Step 4: Implement data URL asset extraction**

In `src/services/browserFileSystemProjectRepository.ts`, add helpers near the constants:

```ts
function getAssetFileExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function isDataUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('data:'));
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64 = ''] = dataUrl.split(',');
  const mimeType = metadata?.match(/^data:(.*?);base64$/)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}
```

Then replace the `saveProject` body with:

```ts
async saveProject(project: ProjectDocument): Promise<void> {
  const directoryHandle = await this.ensureProjectDirectory(project.name);
  const assetsDirectory = await directoryHandle.getDirectoryHandle('assets', { create: true });
  await Promise.all([
    directoryHandle.getDirectoryHandle('cache', { create: true }),
    directoryHandle.getDirectoryHandle('config', { create: true }),
  ]);

  const projectForDisk: ProjectDocument = {
    ...project,
    assets: { ...project.assets },
  };

  for (const [assetId, asset] of Object.entries(project.assets)) {
    if (!isDataUrl(asset.objectUrl)) continue;
    const fileName = asset.fileName ?? `${assetId}.${getAssetFileExtension(asset.mimeType)}`;
    await this.writeBlobFile(assetsDirectory, fileName, dataUrlToBlob(asset.objectUrl));
    projectForDisk.assets[assetId] = {
      ...asset,
      objectUrl: undefined,
      fileName,
      storage: 'file',
    };
  }

  await this.writeJsonFile(directoryHandle, PROJECT_FILE_NAME, projectForDisk);
  const configDirectory = await directoryHandle.getDirectoryHandle('config', { create: true });
  await this.writeJsonFile(configDirectory, PROJECT_CONFIG_FILE_NAME, {
    app: 'LocalStudio.ai',
    projectId: project.id,
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
  });
}
```

Add this method below `writeTextFile`:

```ts
private async writeBlobFile(directoryHandle: FileSystemDirectoryHandle, fileName: string, value: Blob) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(value);
  await writable.close();
}
```

- [x] **Step 5: Run the asset persistence test**

Run:

```bash
npm run test -- --run tests/unit/services/browserFileSystemProjectRepository.assets.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/domain/model.ts src/services/browserFileSystemProjectRepository.ts tests/unit/services/browserFileSystemProjectRepository.assets.test.ts
git commit -m "feat: persist image assets as files"
```

## Task 2: Hydrate File Assets on Project Load

**Files:**
- Modify: `src/services/browserFileSystemProjectRepository.ts`
- Test: `tests/unit/services/browserFileSystemProjectRepository.assets.test.ts`

- [x] **Step 1: Add the failing hydration test**

Append to `tests/unit/services/browserFileSystemProjectRepository.assets.test.ts`:

```ts
it('hydrates file-backed image assets with object URLs on load', async () => {
  const directory = new MockDirectoryHandle();
  const assetsDirectory = new MockDirectoryHandle();
  directory.directories.set('assets', assetsDirectory);
  assetsDirectory.files.set('asset-hero.png', new Blob(['hello'], { type: 'image/png' }));
  directory.files.set(
    'project.json',
    JSON.stringify({
      ...createSampleProject(),
      assets: {
        'asset-hero': {
          id: 'asset-hero',
          type: 'image',
          name: 'Hero',
          mimeType: 'image/png',
          storage: 'file',
          fileName: 'asset-hero.png',
        },
      },
    }),
  );
  const repository = new BrowserFileSystemProjectRepository({
    pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
    recentProjectStore: new MemoryRecentProjectHandleStore(),
  });

  const loaded = await repository.importProject();

  expect(loaded?.assets['asset-hero']?.objectUrl).toMatch(/^blob:/);
});
```

- [x] **Step 2: Run the failing hydration test**

Run:

```bash
npm run test -- --run tests/unit/services/browserFileSystemProjectRepository.assets.test.ts
```

Expected: FAIL because `loadProject()` returns the disk metadata without hydrating `objectUrl`.

- [x] **Step 3: Implement asset hydration**

In `src/services/browserFileSystemProjectRepository.ts`, add this method:

```ts
private async hydrateProjectAssets(project: ProjectDocument): Promise<ProjectDocument> {
  if (!this.directoryHandle) return project;
  const assets: ProjectDocument['assets'] = {};
  let assetsDirectory: FileSystemDirectoryHandle | undefined;

  for (const [assetId, asset] of Object.entries(project.assets)) {
    if (asset.storage !== 'file' || !asset.fileName) {
      assets[assetId] = asset;
      continue;
    }
    assetsDirectory ??= await this.directoryHandle.getDirectoryHandle('assets');
    const fileHandle = await assetsDirectory.getFileHandle(asset.fileName);
    const file = await fileHandle.getFile();
    assets[assetId] = {
      ...asset,
      objectUrl: URL.createObjectURL(file),
    };
  }

  return { ...project, assets };
}
```

Then change the successful `loadProject()` return:

```ts
const project = JSON.parse(await file.text()) as ProjectDocument;
return this.hydrateProjectAssets(project);
```

- [x] **Step 4: Run repository tests**

Run:

```bash
npm run test -- --run tests/unit/services/browserFileSystemProjectRepository.test.ts tests/unit/services/browserFileSystemProjectRepository.assets.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/services/browserFileSystemProjectRepository.ts tests/unit/services/browserFileSystemProjectRepository.assets.test.ts
git commit -m "feat: hydrate file-backed assets"
```

## Task 3: First-Run Setup Service and Screen

**Files:**
- Create: `src/services/localSetupService.ts`
- Create: `src/ui/setup/FirstRunSetupScreen.tsx`
- Modify: `src/services/interfaces.ts`
- Modify: `src/app/composition.ts`
- Modify: `src/App.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/unit/services/localSetupService.test.ts`
- Test: `tests/unit/ui/setup/FirstRunSetupScreen.test.tsx`

- [ ] **Step 1: Add setup service contract test**

Create `tests/unit/services/localSetupService.test.ts`:

```ts
import { BrowserLocalSetupService } from '../../../src/services/localSetupService';

describe('BrowserLocalSetupService', () => {
  it('reports filesystem and chrome translation readiness', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('translation', {
      canTranslate: vi.fn().mockResolvedValue('readily'),
    });
    const service = new BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.fileSystem.status).toBe('ready');
    expect(state.chromeTranslation.status).toBe('ready');
  });
});
```

- [ ] **Step 2: Run the failing setup service test**

Run:

```bash
npm run test -- --run tests/unit/services/localSetupService.test.ts
```

Expected: FAIL because `BrowserLocalSetupService` does not exist.

- [ ] **Step 3: Add setup interfaces**

In `src/services/interfaces.ts`, add:

```ts
export type SetupCapabilityStatus = 'unavailable' | 'needs-setup' | 'ready';

export interface SetupCapabilityState {
  label: string;
  status: SetupCapabilityStatus;
  detail: string;
}

export interface LocalSetupState {
  fileSystem: SetupCapabilityState;
  chromeTranslation: SetupCapabilityState;
}

export interface LocalSetupService {
  checkReadiness(): Promise<LocalSetupState>;
  markSetupComplete(): void;
  hasCompletedSetup(): boolean;
}
```

- [ ] **Step 4: Implement setup service**

Create `src/services/localSetupService.ts`:

```ts
import type { LocalSetupService, LocalSetupState, SetupCapabilityState } from './interfaces';

type TranslationApi = {
  canTranslate?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<'no' | 'readily' | 'after-download'>;
};

type SetupWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: unknown;
    translation?: TranslationApi;
  };

const SETUP_COMPLETE_KEY = 'localstudio.ai.setup-complete';

export class BrowserLocalSetupService implements LocalSetupService {
  async checkReadiness(): Promise<LocalSetupState> {
    return {
      fileSystem: this.checkFileSystem(),
      chromeTranslation: await this.checkChromeTranslation(),
    };
  }

  markSetupComplete(): void {
    window.localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
  }

  hasCompletedSetup(): boolean {
    return window.localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
  }

  private checkFileSystem(): SetupCapabilityState {
    const browserWindow = window as SetupWindow;
    if (typeof browserWindow.showDirectoryPicker === 'function') {
      return { label: 'Project Files', status: 'ready', detail: 'Local project folders are supported.' };
    }
    return { label: 'Project Files', status: 'unavailable', detail: 'Chrome File System Access API is required.' };
  }

  private async checkChromeTranslation(): Promise<SetupCapabilityState> {
    const browserWindow = window as SetupWindow;
    const canTranslate = browserWindow.translation?.canTranslate;
    if (!canTranslate) {
      return { label: 'Chrome Translation', status: 'unavailable', detail: 'Chrome Built-in AI translation is not available.' };
    }
    const result = await canTranslate({ sourceLanguage: 'en', targetLanguage: 'pt' });
    if (result === 'readily') {
      return { label: 'Chrome Translation', status: 'ready', detail: 'Translation is ready.' };
    }
    if (result === 'after-download') {
      return { label: 'Chrome Translation', status: 'needs-setup', detail: 'Chrome must download translation support.' };
    }
    return { label: 'Chrome Translation', status: 'unavailable', detail: 'Translation is unavailable in this browser.' };
  }
}
```

- [ ] **Step 5: Run setup service test**

Run:

```bash
npm run test -- --run tests/unit/services/localSetupService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add first-run screen component test**

Create `tests/unit/ui/setup/FirstRunSetupScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LocalSetupState } from '../../../../src/services/interfaces';
import { FirstRunSetupScreen } from '../../../../src/ui/setup/FirstRunSetupScreen';

const readyState: LocalSetupState = {
  fileSystem: { label: 'Project Files', status: 'ready', detail: 'Ready' },
  chromeTranslation: { label: 'Chrome Translation', status: 'ready', detail: 'Ready' },
};

describe('FirstRunSetupScreen', () => {
  it('enables continuing only when required capabilities are ready', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(<FirstRunSetupScreen setupState={readyState} onRefresh={vi.fn()} onContinue={onContinue} />);

    expect(screen.getByText('LocalStudio.ai runs locally in this browser.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to editor' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Create setup screen**

Create `src/ui/setup/FirstRunSetupScreen.tsx`:

```tsx
import type { LocalSetupState, SetupCapabilityState } from '../../services/interfaces';

interface FirstRunSetupScreenProps {
  setupState: LocalSetupState;
  onRefresh: () => void;
  onContinue: () => void;
}

function CapabilityRow({ capability }: { capability: SetupCapabilityState }) {
  return (
    <article className="setup-capability-row">
      <strong>{capability.label}</strong>
      <span className={`setup-status setup-status-${capability.status}`}>{capability.status}</span>
      <p>{capability.detail}</p>
    </article>
  );
}

export function FirstRunSetupScreen({ setupState, onRefresh, onContinue }: FirstRunSetupScreenProps) {
  const canContinue =
    setupState.fileSystem.status === 'ready' && setupState.chromeTranslation.status === 'ready';

  return (
    <main className="setup-screen">
      <section className="setup-panel">
        <p className="setup-kicker font-orbitron">LocalStudio.ai setup</p>
        <h1 className="font-orbitron">LocalStudio.ai runs locally in this browser.</h1>
        <div className="setup-capability-list">
          <CapabilityRow capability={setupState.fileSystem} />
          <CapabilityRow capability={setupState.chromeTranslation} />
        </div>
        <div className="setup-actions">
          <button type="button" className="secondary-button" onClick={onRefresh}>
            Check again
          </button>
          <button type="button" className="primary-button" disabled={!canContinue} onClick={onContinue}>
            Continue to editor
          </button>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Wire setup service into composition**

Modify `src/app/composition.ts`:

```ts
import { BrowserLocalSetupService } from '../services/localSetupService';
```

Add `localSetupService` to `AppServices`:

```ts
localSetupService: LocalSetupService;
```

Add it to `createAppServices()`:

```ts
localSetupService: new BrowserLocalSetupService(),
```

- [ ] **Step 9: Gate the app in `App.tsx`**

Modify `src/App.tsx` to check setup state:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { LocalSetupState } from './services/interfaces';
import { FirstRunSetupScreen } from './ui/setup/FirstRunSetupScreen';
```

Inside `App()` after `services`:

```tsx
const [setupState, setSetupState] = useState<LocalSetupState | undefined>();
const [setupComplete, setSetupComplete] = useState(() => services.localSetupService.hasCompletedSetup());

useEffect(() => {
  if (setupComplete) return;
  void services.localSetupService.checkReadiness().then(setSetupState);
}, [services.localSetupService, setupComplete]);

if (!setupComplete) {
  if (!setupState) return <div className="setup-screen">Checking local setup...</div>;
  return (
    <FirstRunSetupScreen
      setupState={setupState}
      onRefresh={() => {
        void services.localSetupService.checkReadiness().then(setSetupState);
      }}
      onContinue={() => {
        services.localSetupService.markSetupComplete();
        setSetupComplete(true);
      }}
    />
  );
}
```

- [ ] **Step 10: Add setup styles**

Append to `src/app/styles.css`:

```css
.setup-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #050d10;
  color: #ffffff;
  padding: 32px;
}

.setup-panel {
  width: min(720px, 100%);
  border: 1px solid rgba(55, 253, 118, 0.45);
  background: #000000;
  padding: 28px;
}

.setup-kicker {
  color: #37fd76;
  text-transform: uppercase;
}

.setup-capability-list {
  display: grid;
  gap: 12px;
  margin: 24px 0;
}

.setup-capability-row {
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 14px;
  background: #050d10;
}

.setup-status {
  float: right;
  color: #37fd76;
  text-transform: uppercase;
}

.setup-status-unavailable {
  color: #ff6b6b;
}

.setup-status-needs-setup {
  color: #ffea00;
}
```

- [ ] **Step 11: Run setup tests**

Run:

```bash
npm run test -- --run tests/unit/services/localSetupService.test.ts tests/unit/ui/setup/FirstRunSetupScreen.test.tsx tests/unit/app/App.test.tsx
```

Expected: PASS after updating existing app tests to mark setup complete with `window.localStorage.setItem('localstudio.ai.setup-complete', 'true')` before rendering `App`.

- [ ] **Step 12: Commit**

```bash
git add src/services/interfaces.ts src/services/localSetupService.ts src/app/composition.ts src/App.tsx src/ui/setup/FirstRunSetupScreen.tsx src/app/styles.css tests/unit/services/localSetupService.test.ts tests/unit/ui/setup/FirstRunSetupScreen.test.tsx tests/unit/app/App.test.tsx
git commit -m "feat: add first run local setup"
```

## Task 4: Chrome Built-in AI Translator Service

**Files:**
- Create: `src/services/chromeTranslatorService.ts`
- Modify: `src/app/composition.ts`
- Test: `tests/unit/services/chromeTranslatorService.test.ts`

- [ ] **Step 1: Write Chrome translator tests**

Create `tests/unit/services/chromeTranslatorService.test.ts`:

```ts
import { ChromeTranslatorService } from '../../../src/services/chromeTranslatorService';

describe('ChromeTranslatorService', () => {
  it('detects language with Chrome language detector when available', async () => {
    vi.stubGlobal('languageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'en', confidence: 0.95 }]),
      }),
    });
    const service = new ChromeTranslatorService();

    await expect(service.detectLanguage('Hello')).resolves.toBe('en');
  });

  it('translates with Chrome translation API', async () => {
    vi.stubGlobal('translation', {
      canTranslate: vi.fn().mockResolvedValue('readily'),
      createTranslator: vi.fn().mockResolvedValue({
        translate: vi.fn().mockResolvedValue('Olá'),
      }),
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hello', 'pt')).resolves.toBe('Olá');
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm run test -- --run tests/unit/services/chromeTranslatorService.test.ts
```

Expected: FAIL because `ChromeTranslatorService` does not exist.

- [ ] **Step 3: Implement Chrome translator**

Create `src/services/chromeTranslatorService.ts`:

```ts
import type { TranslatorService } from './interfaces';

type ChromeLanguageDetector = {
  detect: (text: string) => Promise<Array<{ detectedLanguage: string; confidence: number }>>;
};

type ChromeTranslator = {
  translate: (text: string) => Promise<string>;
};

type ChromeAiWindow = Window &
  typeof globalThis & {
    languageDetector?: {
      create: () => Promise<ChromeLanguageDetector>;
    };
    translation?: {
      canTranslate?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<'no' | 'readily' | 'after-download'>;
      createTranslator?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<ChromeTranslator>;
    };
  };

export class ChromeTranslatorService implements TranslatorService {
  async detectLanguage(text: string): Promise<string> {
    const detector = await (window as ChromeAiWindow).languageDetector?.create();
    if (!detector) return 'und';
    const [best] = await detector.detect(text);
    return best?.detectedLanguage ?? 'und';
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    const sourceLanguage = await this.detectLanguage(text);
    const translation = (window as ChromeAiWindow).translation;
    const availability = await translation?.canTranslate?.({ sourceLanguage, targetLanguage });
    if (!translation?.createTranslator || availability === 'no' || availability === undefined) {
      throw new Error('Chrome Built-in AI translation is unavailable.');
    }
    const translator = await translation.createTranslator({ sourceLanguage, targetLanguage });
    return translator.translate(text);
  }
}
```

- [ ] **Step 4: Wire composition**

In `src/app/composition.ts`, replace `MockTranslatorService` wiring with Chrome service:

```ts
import { ChromeTranslatorService } from '../services/chromeTranslatorService';
```

Use:

```ts
translatorService: new ChromeTranslatorService(),
```

Tests that need deterministic translation must inject `MockTranslatorService` through `createAppServices()` and then override `services.translatorService`.

- [ ] **Step 5: Run service tests**

Run:

```bash
npm run test -- --run tests/unit/services/chromeTranslatorService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/chromeTranslatorService.ts src/app/composition.ts tests/unit/services/chromeTranslatorService.test.ts
git commit -m "feat: add chrome translator service"
```

## Task 5: Translation Commands and View-Model Actions

**Files:**
- Modify: `src/domain/commands/basicCommands.ts`
- Modify: `src/ui/editor/useEditorViewModel.ts`
- Test: `tests/unit/domain/commands/translateTextElementsCommand.test.ts`
- Test: `tests/unit/ui/editor/EditorShell.test.tsx`

- [ ] **Step 1: Write command tests**

Create `tests/unit/domain/commands/translateTextElementsCommand.test.ts`:

```ts
import { TranslateTextElementsCommand } from '../../../../src/domain/commands/basicCommands';
import { createSampleProject } from '../../../../src/domain/sampleProject';

describe('TranslateTextElementsCommand', () => {
  it('updates only visible unlocked text elements in the requested set', () => {
    const project = createSampleProject();
    const next = new TranslateTextElementsCommand({
      translations: {
        'text-title': 'Título traduzido',
        'text-subtitle': 'Legenda traduzida',
      },
    }).execute({
      ...project,
      elements: {
        ...project.elements,
        'text-subtitle': {
          ...project.elements['text-subtitle']!,
          locked: true,
        },
      },
    });

    expect(next.elements['text-title']).toMatchObject({ text: 'Título traduzido' });
    expect(next.elements['text-subtitle']).toMatchObject({ text: 'Browser-native creative automation' });
  });
});
```

- [ ] **Step 2: Run failing command test**

Run:

```bash
npm run test -- --run tests/unit/domain/commands/translateTextElementsCommand.test.ts
```

Expected: FAIL because `TranslateTextElementsCommand` does not exist.

- [ ] **Step 3: Implement translation command**

Append to `src/domain/commands/basicCommands.ts`:

```ts
export class TranslateTextElementsCommand implements EditorCommand {
  readonly description = 'Translate text elements';

  constructor(private readonly payload: { translations: Record<string, string> }) {}

  execute(project: ProjectDocument): ProjectDocument {
    const elements = { ...project.elements };
    let changed = false;

    for (const [elementId, translatedText] of Object.entries(this.payload.translations)) {
      const element = elements[elementId];
      if (!element || element.type !== 'text' || element.locked || !element.visible) continue;
      elements[elementId] = {
        ...element,
        text: translatedText,
      };
      changed = true;
    }

    if (!changed) return project;
    return {
      ...project,
      elements,
      updatedAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: Add view-model translation actions**

In `src/ui/editor/useEditorViewModel.ts`, import `TranslateTextElementsCommand`.

Add these helpers inside `useEditorViewModel`:

```ts
function getTranslatableTextElementIds(scope: 'selection' | 'slide' | 'deck') {
  if (scope === 'selection') {
    return selectedElementIds.filter((id) => {
      const element = project.elements[id];
      return element?.type === 'text' && element.visible && !element.locked;
    });
  }
  if (scope === 'slide') {
    const page = project.pages.find((item) => item.id === activePageId);
    return (page?.elementIds ?? []).filter((id) => {
      const element = project.elements[id];
      return element?.type === 'text' && element.visible && !element.locked;
    });
  }
  return Object.values(project.elements)
    .filter((element) => element.type === 'text' && element.visible && !element.locked)
    .map((element) => element.id);
}

async function translateTextScope(scope: 'selection' | 'slide' | 'deck', targetLanguage = 'pt') {
  const elementIds = getTranslatableTextElementIds(scope);
  if (elementIds.length === 0) return;
  const translations: Record<string, string> = {};
  for (const elementId of elementIds) {
    const element = project.elements[elementId];
    if (!element || element.type !== 'text') continue;
    translations[elementId] = await services.translatorService.translate(element.text, targetLanguage);
  }
  commitProject((currentProject) => new TranslateTextElementsCommand({ translations }).execute(currentProject));
}
```

Expose these methods in the returned view-model object:

```ts
translateSelectedText: () => translateTextScope('selection'),
translateCurrentSlide: () => translateTextScope('slide'),
translateDeck: () => translateTextScope('deck'),
canTranslateSelection: getTranslatableTextElementIds('selection').length > 0,
```

- [ ] **Step 5: Add view-model test through EditorShell**

In `tests/unit/ui/editor/EditorShell.test.tsx`, add:

```tsx
it('translates selected text through the floating toolbar', async () => {
  const user = userEvent.setup();
  const services = createAppServices();
  services.translatorService = {
    detectLanguage: vi.fn().mockResolvedValue('en'),
    translate: vi.fn().mockResolvedValue('Texto traduzido'),
  };
  render(<EditorShell services={services} />);

  await user.click(screen.getByRole('button', { name: 'AI Design Revolution' }));
  await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

  expect(await screen.findByText('Texto traduzido')).toBeInTheDocument();
});
```

If the canvas text is not accessible by role/name in the test environment, select the text layer through the Layout panel:

```tsx
await user.click(screen.getByRole('button', { name: 'AI Design Revolution' }));
```

- [ ] **Step 6: Run translation tests**

Run:

```bash
npm run test -- --run tests/unit/domain/commands/translateTextElementsCommand.test.ts tests/unit/ui/editor/EditorShell.test.tsx
```

Expected: PASS after wiring UI in Task 6.

- [ ] **Step 7: Commit after Task 6 UI wiring passes**

Do not commit this task alone until Task 6 exposes the actions and tests pass.

## Task 6: Translation UI Entry Points

**Files:**
- Modify: `src/ui/editor/TopToolbar.tsx`
- Modify: `src/ui/editor/FloatingSelectionToolbar.tsx`
- Modify: `src/ui/editor/CanvasWorkspace.tsx`
- Modify: `src/ui/editor/EditorShell.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/unit/ui/editor/TopToolbar.test.tsx`
- Test: `tests/unit/ui/editor/EditorShell.test.tsx`

- [ ] **Step 1: Add toolbar tests**

In `tests/unit/ui/editor/TopToolbar.test.tsx`, extend the first test:

```tsx
const onTranslateDeck = vi.fn();
```

Pass:

```tsx
onTranslateDeck={onTranslateDeck}
```

After Edit menu opens, assert:

```tsx
await user.click(screen.getByRole('button', { name: 'Edit' }));
await user.click(screen.getByRole('menuitem', { name: 'Translate Deck' }));
expect(onTranslateDeck).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Wire `Edit > Translate Deck`**

In `src/ui/editor/TopToolbar.tsx`, add prop:

```ts
onTranslateDeck?: () => void;
```

Destructure it, then add to `Edit` menu actions after `Redo`:

```ts
{ label: 'Translate Deck', disabled: !onTranslateDeck, onSelect: onTranslateDeck },
```

- [ ] **Step 3: Wire floating toolbar selected-text translation**

In `src/ui/editor/FloatingSelectionToolbar.tsx`, add props:

```ts
canTranslateSelection?: boolean;
onTranslateSelectedText?: (() => void) | undefined;
```

Update the translate button:

```ts
{
  label: 'Translate Selected Text',
  icon: 'translate',
  tone: 'ai',
  onClick: onTranslateSelectedText,
  disabled: !canTranslateSelection,
}
```

Extend `ToolbarAction` with:

```ts
disabled?: boolean;
```

Then set button disabled to:

```tsx
disabled={disabled || action.disabled}
```

- [ ] **Step 4: Add slide translate button**

In `src/ui/editor/CanvasWorkspace.tsx`, add prop:

```ts
onTranslateCurrentSlide?: (() => void) | undefined;
```

Render a compact button near the existing canvas controls:

```tsx
<button
  className="slide-translate-button"
  type="button"
  aria-label="Translate Current Slide"
  onClick={onTranslateCurrentSlide}
>
  <span className="material-symbols-outlined">translate</span>
</button>
```

- [ ] **Step 5: Pass translation callbacks from `EditorShell`**

In `src/ui/editor/EditorShell.tsx`, pass:

```tsx
onTranslateDeck={() => {
  void vm.translateDeck();
}}
```

to `TopToolbar`.

Pass to `CanvasWorkspace`:

```tsx
onTranslateCurrentSlide={() => {
  void vm.translateCurrentSlide();
}}
```

Pass to `FloatingSelectionToolbar` through the existing `CanvasWorkspace` props path:

```tsx
canTranslateSelection={vm.canTranslateSelection}
onTranslateSelectedText={() => {
  void vm.translateSelectedText();
}}
```

- [ ] **Step 6: Add styling**

Append to `src/app/styles.css`:

```css
.slide-translate-button {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(55, 253, 118, 0.5);
  background: #000000;
  color: #37fd76;
  cursor: pointer;
}

.slide-translate-button:hover {
  border-color: #37fd76;
  box-shadow: 0 0 14px rgba(55, 253, 118, 0.28);
}
```

- [ ] **Step 7: Run UI translation tests**

Run:

```bash
npm run test -- --run tests/unit/ui/editor/TopToolbar.test.tsx tests/unit/ui/editor/EditorShell.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit translation command/UI slice**

```bash
git add src/domain/commands/basicCommands.ts src/ui/editor/useEditorViewModel.ts src/ui/editor/TopToolbar.tsx src/ui/editor/FloatingSelectionToolbar.tsx src/ui/editor/CanvasWorkspace.tsx src/ui/editor/EditorShell.tsx src/app/styles.css tests/unit/domain/commands/translateTextElementsCommand.test.ts tests/unit/ui/editor/TopToolbar.test.tsx tests/unit/ui/editor/EditorShell.test.tsx
git commit -m "feat: add translation entry points"
```

## Task 7: Verification and Spec Update

**Files:**
- Modify: `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`

- [ ] **Step 1: Update implementation status**

In the spec Ready section, add:

```md
- Storage hardening now writes imported/generated data URL image assets into `assets/` and keeps project metadata in `project.json`.
- First-run setup checks File System Access and Chrome Built-in AI translation readiness before enabling the editor.
- Chrome Built-in AI translation is wired for selected text, current slide, and full deck entry points.
```

In Known limitations, remove or revise the corresponding stale bullets so they no longer claim these items are entirely missing.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected:

- lint passes.
- typecheck passes.
- tests pass.
- build completes with only the existing large chunk warning if present.

- [ ] **Step 3: Commit docs and final verification state**

```bash
git add docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md
git commit -m "docs: update storage setup translation status"
```

## Self-Review

- Spec coverage: Storage hardening is covered by Tasks 1-2. First-run AI setup is covered by Task 3. Chrome Built-in AI translation is covered by Tasks 4-6. Spec status refresh is covered by Task 7.
- Placeholder scan: no `TBD`, `TODO`, or vague "add tests" steps remain. Each task includes concrete files, test code, commands, expected results, and commit messages.
- Type consistency: `storage`, `fileName`, `LocalSetupService`, `LocalSetupState`, `ChromeTranslatorService`, and `TranslateTextElementsCommand` are introduced before later tasks reference them.
- Main branch note: execution on `main` is explicitly approved by the user for this pass.
