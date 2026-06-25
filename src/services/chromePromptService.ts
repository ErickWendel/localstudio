import type { PromptApiAvailability, PromptService } from './interfaces';

type ChromePromptAvailability =
  | 'available'
  | 'readily'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

interface ChromePromptSession {
  destroy?: () => void;
}

interface ChromeLanguageModelApi {
  availability?: () => Promise<ChromePromptAvailability>;
  create?: (options?: { monitor?: (monitorTarget: EventTarget) => void }) => Promise<ChromePromptSession>;
}

function getLanguageModelApi() {
  if (typeof window === 'undefined') return undefined;
  const globalWindow = window as Window & {
    LanguageModel?: ChromeLanguageModelApi;
    ai?: { languageModel?: ChromeLanguageModelApi };
  };
  return globalWindow.LanguageModel ?? globalWindow.ai?.languageModel;
}

function normalizePromptAvailability(availability: ChromePromptAvailability | undefined): PromptApiAvailability {
  if (availability === 'available' || availability === 'readily') return 'ready';
  if (availability === 'downloadable') return 'downloadable';
  if (availability === 'downloading') return 'downloading';
  return 'unavailable';
}

export class ChromePromptService implements PromptService {
  private ready = false;

  async checkAvailability(): Promise<PromptApiAvailability> {
    if (this.ready) return 'ready';
    const languageModel = getLanguageModelApi();
    const availability = await languageModel?.availability?.();
    return normalizePromptAvailability(availability);
  }

  async preparePromptApi(options?: { onProgress?: (progress: number) => void }): Promise<void> {
    const languageModel = getLanguageModelApi();
    if (!languageModel?.create) throw new Error('Chrome Prompt API is unavailable.');

    options?.onProgress?.(5);
    const session = await languageModel.create({
      monitor: (monitorTarget) => {
        monitorTarget.addEventListener('downloadprogress', (event) => {
          const progressEvent = event as CustomEvent<{ loaded?: number; total?: number }>;
          const loaded = progressEvent.detail?.loaded ?? 0;
          const total = progressEvent.detail?.total ?? 1;
          options?.onProgress?.(Math.max(5, Math.min(100, Math.round((loaded / total) * 100))));
        });
      },
    });
    session.destroy?.();
    this.ready = true;
    options?.onProgress?.(100);
  }
}
