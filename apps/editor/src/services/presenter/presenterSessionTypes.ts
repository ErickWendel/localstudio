import type { ProjectDocument } from '../../domain/documents/model';
import type { AnimationPreviewState } from '../../ui/editor/animation/useAnimationPreviewController';
import type {
  PresenterRemoteSession,
  PresenterRemoteTimerState,
} from '@localstudio/presenter-remote/protocol';

export type PresenterRemoteSessionMetadata = PresenterRemoteSession & {
  qrUrl: string;
};

export interface PresenterStatePayload {
  activePageId: string;
  animationPreview: AnimationPreviewState | undefined;
  project: ProjectDocument;
  presenterMode?: 'presenting' | 'ready' | undefined;
  remoteSession?: PresenterRemoteSessionMetadata | undefined;
  timer?: PresenterRemoteTimerState | undefined;
}

export type PresenterWindowCommand =
  | { command: 'close' }
  | { command: 'go-to-page'; pageId: string }
  | { command: 'next' }
  | { command: 'pause-timer' }
  | { command: 'previous' }
  | { command: 'request-state' }
  | { command: 'reset-timer' }
  | { command: 'resume-timer' }
  | { command: 'start-presenting' }
  | { command: 'update-timer'; timer: PresenterRemoteTimerState }
  | { command: 'update-notes'; notes: string; pageId: string };

export interface PresenterStateMessage {
  payload: PresenterStatePayload;
  sessionId: string;
  source: 'localstudio-presenter-main';
  type: 'state';
}

export type PresenterCommandMessage = PresenterWindowCommand & {
  sessionId: string;
  source: 'localstudio-presenter-main' | 'localstudio-presenter-window';
  type: 'command';
};
