import type { ProjectDocument } from '../../domain/documents/model';
import type { AnimationPreviewState } from '../../ui/editor/animation/useAnimationPreviewController';
import type {
  PresenterRemotePeerSession,
  PresenterRemoteSession,
  PresenterRemoteTimerState,
} from '@localstudio/presenter-remote/protocol';

export type PresenterRemoteSessionMetadata = PresenterRemoteSession & {
  controlPeerId?: PresenterRemotePeerSession['controlPeerId'] | undefined;
  qrUrl: string;
  transport?: PresenterRemotePeerSession['transport'] | undefined;
};

export interface PresenterStatePayload {
  activePageId: string;
  animationPreview: AnimationPreviewState | undefined;
  project: ProjectDocument;
  presenterMode?: 'presenting' | 'ready' | undefined;
  remoteSession?: PresenterRemoteSessionMetadata | undefined;
  streamPeerId?: string | undefined;
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
  | { command: 'update-stream-peer'; peerId?: string | undefined }
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
