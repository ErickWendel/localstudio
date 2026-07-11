import type {
  PresenterStatePayload,
  PresenterWindowCommand,
} from '../../../apps/editor/src/services/presenter/presenterSessionTypes';

export type E2EPresenterHarness = {
  activePageId: () => string;
  commands: string[];
  notesFor: (pageId: string) => string | undefined;
  sendCommand: (command: 'pause-timer' | 'reset-timer' | 'resume-timer') => void;
};

export type PresenterRoutePayload = PresenterStatePayload;
export type PresenterRouteWindowCommand = PresenterWindowCommand;

declare global {
  interface Window {
    __LOCALSTUDIO_E2E_PRESENTER__?: E2EPresenterHarness | undefined;
  }
}
