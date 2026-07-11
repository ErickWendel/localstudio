import type { DriveStep } from 'driver.js';

export interface EditorAiWorkflowTourHandle {
  start: () => void;
}

export interface EditorAiWorkflowTourCallbacks {
  onCloseTourSurfaces: () => void;
  onOpenAiTools: () => void;
  onOpenMirrorSettings: () => void;
  onOpenSettings: () => void;
}

export interface EditorAiWorkflowTourStep extends DriveStep {
  id: string;
  prepare?: (() => Promise<void> | void) | undefined;
}
