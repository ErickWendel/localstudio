import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type { Asset } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  BackgroundRemovalService,
  TranslatorService,
} from '../../../../src/services/contracts/interfaces';
import { editorShellMediaFixtures } from './EditorShell.media-fixtures';
import { editorShellPersistenceFixtures } from './EditorShell.persistence-fixtures';

function createAppServices(options: Parameters<typeof createRealAppServices>[0] = {}) {
  vi.stubGlobal('showDirectoryPicker', vi.fn());
  return createRealAppServices({
    initialProject: sampleProject.createSampleProject(),
    ...options,
  });
}

async function waitForShareButtonReady() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Share' })).not.toBeDisabled();
  });
}

async function startFullscreenPresentation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
  await user.click(screen.getByRole('menuitem', { name: 'Present in fullscreen' }));
}

function createMultiTextProject(textCount: number) {
  const project = sampleProject.createSampleProject();
  const elementIds = Array.from({ length: textCount }, (_, index) => `bulk-text-${index + 1}`);
  return {
    ...project,
    elements: {
      ...project.elements,
      ...Object.fromEntries(
        elementIds.map((elementId, index) => [
          elementId,
          {
            id: elementId,
            type: 'text' as const,
            text: `Deck text ${index + 1}`,
            x: 100,
            y: 100 + index * 20,
            width: 300,
            height: 60,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 600,
            fill: '#ffffff',
            align: 'left' as const,
          },
        ]),
      ),
    },
    pages: elementIds.map((elementId, index) => ({
      ...project.pages[0]!,
      id: `bulk-page-${index + 1}`,
      name: `Slide ${index + 1}`,
      elementIds: [elementId],
    })),
  };
}

class InstantBackgroundRemovalService implements BackgroundRemovalService {
  prepareBackgroundRemoval(
    asset: Asset,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    void asset;
    options?.onProgress?.(100);
    return Promise.resolve();
  }

  previewBackgroundMask(): Promise<{ maskUrl: string; score: number }> {
    return Promise.resolve({ maskUrl: 'data:image/png;base64,test', score: 0.9 });
  }

  removeBackground(asset: Asset): Promise<{ asset: Asset }> {
    return Promise.resolve({ asset });
  }
}

class RecordingTranslatorService implements TranslatorService {
  prepareTranslation = vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );

  translate = vi.fn((text: string, targetLanguage: string) =>
    Promise.resolve(`${targetLanguage}:${text}`),
  );

  detectLanguage = vi.fn(() => {
    return Promise.resolve('en');
  });
}

class ConcurrentRecordingTranslatorService extends RecordingTranslatorService {
  activeTranslations = 0;
  private releaseTranslationGate: (() => void) | undefined;
  private readonly translationGate = new Promise<void>((resolve) => {
    this.releaseTranslationGate = resolve;
  });
  maxConcurrentTranslations = 0;

  finishTranslations() {
    this.releaseTranslationGate?.();
  }

  override translate = vi.fn(async (text: string, targetLanguage: string) => {
    this.activeTranslations += 1;
    this.maxConcurrentTranslations = Math.max(
      this.maxConcurrentTranslations,
      this.activeTranslations,
    );
    await this.translationGate;
    this.activeTranslations -= 1;
    return `${targetLanguage}:${text}`;
  });
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createClipboardData(options: { editorObject?: boolean; files?: File[] } = {}) {
  const data = new Map<string, string>();
  if (options.editorObject) data.set('application/x-localstudio-editor-elements', '1');

  return {
    files: options.files ?? [],
    items: [],
    types: Array.from(data.keys()),
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    }),
  };
}

function createReadyPrepareTranslationMock() {
  return vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );
}

async function openLeftTab(
  user: ReturnType<typeof userEvent.setup>,
  name: 'AI Tools' | 'Animate' | 'Elements' | 'Layout',
) {
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') {
    await user.click(tab);
  }
}

async function selectTitleLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  await user.click(screen.getByRole('button', { name: 'Title' }));
}

async function selectImageLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  await user.click(screen.getByRole('button', { name: 'Selected Image' }));
}

export const editorShellTestHarness = {
  ConcurrentRecordingTranslatorService,
  InstantBackgroundRemovalService,
  RecordingTranslatorService,
  createAppServices,
  createClipboardData,
  createDeferred,
  createMultiTextProject,
  createReadyPrepareTranslationMock,
  ...editorShellMediaFixtures,
  ...editorShellPersistenceFixtures,
  openLeftTab,
  selectImageLayer,
  selectTitleLayer,
  startFullscreenPresentation,
  waitForShareButtonReady,
};
