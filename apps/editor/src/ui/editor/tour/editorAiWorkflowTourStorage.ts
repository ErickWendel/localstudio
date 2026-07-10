const storageKey = 'localstudio.ai-workflow-tour.seen';

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

export const editorAiWorkflowTourStorage = {
  readSeen,
  writeSeen,
};
