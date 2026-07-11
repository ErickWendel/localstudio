import { editorAiWorkflowTourStorage } from './editorAiWorkflowTourStorage';

function readDisableEnv() {
  return import.meta.env.VITE_DISABLE_EDITOR_TOUR === 'true';
}

export const editorAiWorkflowTourAvailability = {
  isEnabled() {
    if (import.meta.env.MODE === 'test') return false;
    return editorAiWorkflowTourStorage.readEnabledOverride() || !readDisableEnv();
  },
};
