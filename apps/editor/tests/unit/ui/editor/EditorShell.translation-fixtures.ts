import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { TranslatorService } from '../../../../src/services/contracts/interfaces';

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

export const editorShellTranslationFixtures = {
  ConcurrentRecordingTranslatorService,
  RecordingTranslatorService,
  createDeferred,
  createMultiTextProject,
  createReadyPrepareTranslationMock,
};
