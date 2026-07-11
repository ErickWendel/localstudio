const storageKey = 'localstudio.ai-workflow-tour.seen';
const enabledOverrideKey = 'localstudio.ai-workflow-tour.enabled';

function readSeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return true;
  }
}

function writeSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    return;
  }
}

function readEnabledOverride() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(enabledOverrideKey) === '1';
  } catch {
    return false;
  }
}

export const editorAiWorkflowTourStorage = {
  readEnabledOverride,
  readSeen,
  writeSeen,
};
