import { editorAiWorkflowTourStorage } from './editorAiWorkflowTourStorage';

function readDisableEnv() {
  return import.meta.env.VITE_DISABLE_EDITOR_TOUR === 'true';
}

// The WebMCP showcase embeds the editor as an agent-driven canvas; a guided tour would cover it.
function isWebMcpShowcaseFrame() {
  if (typeof window === 'undefined') return false;
  return new URL(window.location.href).searchParams.get('webmcp') === '1';
}

export const editorAiWorkflowTourAvailability = {
  isEnabled() {
    if (import.meta.env.MODE === 'test') return false;
    if (isWebMcpShowcaseFrame()) return false;
    return editorAiWorkflowTourStorage.readEnabledOverride() || !readDisableEnv();
  },
};
