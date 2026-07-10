function readDisableEnv() {
  return import.meta.env.VITE_DISABLE_EDITOR_TOUR === 'true';
}

export const editorAiWorkflowTourAvailability = {
  isEnabled() {
    return import.meta.env.MODE !== 'test' && !readDisableEnv();
  },
};
