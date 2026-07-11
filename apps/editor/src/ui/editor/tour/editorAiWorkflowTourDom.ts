import type { EditorAiWorkflowTourStep } from './editorAiWorkflowTourTypes';

function tourSelector(id: string) {
  return `[data-tour-id="${id}"]`;
}

function firstTourElement(...ids: string[]) {
  return () => {
    for (const id of ids) {
      const target = document.querySelector(tourSelector(id));
      if (target) return target;
    }
    throw new Error(`Missing tour element for ${ids.join(', ')}`);
  };
}

function waitForTourPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

async function clickWhenAvailable(id: string) {
  await waitForTourPaint();
  const target = document.querySelector<HTMLElement>(tourSelector(id));
  target?.click();
  await waitForTourPaint();
}

async function ensureTargetAvailable(targetId: string, openerId: string) {
  await waitForTourPaint();
  if (document.querySelector(tourSelector(targetId))) return;
  await clickWhenAvailable(openerId);
}

async function openAiToolsForTour({
  fallbackOpenerId,
  onOpenAiTools,
  panelId,
}: {
  fallbackOpenerId: string;
  onOpenAiTools: () => void;
  panelId: string;
}) {
  onOpenAiTools();
  await waitForTourPaint();
  if (document.querySelector(tourSelector(panelId))) return;
  await clickWhenAvailable(fallbackOpenerId);
}

function collapseDocumentMenus() {
  document.body.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
    }),
  );
}

function resolveStepElement(step: EditorAiWorkflowTourStep): Element | undefined {
  if (step.element === undefined) return undefined;
  if (typeof step.element === 'string') {
    return document.querySelector(step.element) ?? undefined;
  }
  if (typeof step.element === 'function') {
    try {
      return step.element();
    } catch {
      return undefined;
    }
  }
  return step.element;
}

export const editorAiWorkflowTourDom = {
  clickWhenAvailable,
  collapseDocumentMenus,
  ensureTargetAvailable,
  firstTourElement,
  openAiToolsForTour,
  resolveStepElement,
  tourSelector,
  waitForTourPaint,
};
