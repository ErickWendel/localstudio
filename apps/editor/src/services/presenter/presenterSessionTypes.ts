import type { ProjectDocument } from '../../domain/documents/model';
import type { AnimationPreviewState } from '../../ui/editor/animation/useAnimationPreviewController';

export interface PresenterStatePayload {
  activePageId: string;
  animationPreview: AnimationPreviewState | undefined;
  project: ProjectDocument;
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
  | { command: 'update-notes'; notes: string; pageId: string };

export interface PresenterStateMessage {
  payload: PresenterStatePayload;
  sessionId: string;
  source: 'localstudio-presenter-main';
  type: 'state';
}

export type PresenterCommandMessage = PresenterWindowCommand & {
  sessionId: string;
  source: 'localstudio-presenter-window';
  type: 'command';
};
