import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import { editorAiWorkflowTourAvailability } from './editorAiWorkflowTourAvailability';
import { editorAiWorkflowTourDom } from './editorAiWorkflowTourDom';
import { createEditorAiWorkflowTourSteps } from './editorAiWorkflowTourSteps';
import { editorAiWorkflowTourStorage } from './editorAiWorkflowTourStorage';
import type {
  EditorAiWorkflowTourCallbacks,
  EditorAiWorkflowTourHandle,
  EditorAiWorkflowTourStep,
} from './editorAiWorkflowTourTypes';

interface EditorAiWorkflowTourProps extends EditorAiWorkflowTourCallbacks {
  ref?: Ref<EditorAiWorkflowTourHandle>;
}

function createDriveStep(step: EditorAiWorkflowTourStep): DriveStep {
  const driveStep: DriveStep = {
    data: { id: step.id },
  };
  if (step.disableActiveInteraction !== undefined) {
    driveStep.disableActiveInteraction = step.disableActiveInteraction;
  }
  if (step.element !== undefined) {
    driveStep.element = step.element;
  }
  if (step.popover !== undefined) {
    driveStep.popover = step.popover;
  }
  return driveStep;
}

async function prepareStep(step: EditorAiWorkflowTourStep) {
  await step.prepare?.();
  await editorAiWorkflowTourDom.waitForTourPaint();
}

async function moveToAvailableStep(
  activeDriver: Driver,
  tourSteps: EditorAiWorkflowTourStep[],
  startIndex: number,
  direction: 1 | -1,
) {
  for (let stepIndex = startIndex; stepIndex >= 0 && stepIndex < tourSteps.length; stepIndex += direction) {
    const nextStep = tourSteps[stepIndex];
    if (!nextStep) return false;

    await prepareStep(nextStep);
    if (!editorAiWorkflowTourDom.resolveStepElement(nextStep)) continue;

    activeDriver.moveTo(stepIndex);
    await editorAiWorkflowTourDom.waitForTourPaint();
    activeDriver.refresh();
    return true;
  }

  return false;
}

export function EditorAiWorkflowTour({
  onCloseTourSurfaces,
  onOpenAiTools,
  onOpenSettings,
  onOpenMirrorSettings,
  ref,
}: EditorAiWorkflowTourProps) {
  const callbacksRef = useRef<Omit<EditorAiWorkflowTourProps, 'ref'>>({
    onCloseTourSurfaces,
    onOpenAiTools,
    onOpenMirrorSettings,
    onOpenSettings,
  });
  const driverRef = useRef<Driver | undefined>(undefined);
  const startingRef = useRef(false);

  useEffect(() => {
    callbacksRef.current = {
      onCloseTourSurfaces,
      onOpenAiTools,
      onOpenMirrorSettings,
      onOpenSettings,
    };
  }, [onCloseTourSurfaces, onOpenAiTools, onOpenMirrorSettings, onOpenSettings]);

  const finishTour = useCallback(
    (activeDriver: Driver) => {
      editorAiWorkflowTourStorage.writeSeen();
      editorAiWorkflowTourDom.collapseDocumentMenus();
      callbacksRef.current.onCloseTourSurfaces();
      activeDriver.destroy();
    },
    [],
  );

  const startTour = useCallback(async () => {
    if (!editorAiWorkflowTourAvailability.isEnabled()) return;
    if (startingRef.current || driverRef.current?.isActive()) return;

    startingRef.current = true;
    const tourSteps = createEditorAiWorkflowTourSteps({
      ...callbacksRef.current,
    });
    await prepareStep(tourSteps[0]!);
    const driverObj = driver({
      allowClose: true,
      allowKeyboardControl: true,
      animate: true,
      doneBtnText: 'Done',
      nextBtnText: 'Next',
      overlayOpacity: 0.62,
      popoverClass: 'localstudio-tour-popover',
      prevBtnText: 'Back',
      progressText: '{{current}} / {{total}}',
      showButtons: ['previous', 'next', 'close'],
      showProgress: true,
      smoothScroll: true,
      stagePadding: 8,
      stageRadius: 6,
      steps: tourSteps.map(createDriveStep),
      onCloseClick: (_element, _step, { driver: activeDriver }) => {
        finishTour(activeDriver);
      },
      onDoneClick: (_element, _step, { driver: activeDriver }) => {
        finishTour(activeDriver);
      },
      onDestroyed: () => {
        editorAiWorkflowTourDom.collapseDocumentMenus();
        callbacksRef.current.onCloseTourSurfaces();
        driverRef.current = undefined;
      },
      onNextClick: () => {
        void (async () => {
          if (driverObj.isLastStep()) {
            finishTour(driverObj);
            return;
          }

          const nextIndex = (driverObj.getActiveIndex() ?? 0) + 1;
          const didMove = await moveToAvailableStep(driverObj, tourSteps, nextIndex, 1);
          if (!didMove) finishTour(driverObj);
        })();
      },
      onPrevClick: () => {
        void (async () => {
          const previousIndex = Math.max(0, (driverObj.getActiveIndex() ?? 0) - 1);
          await moveToAvailableStep(driverObj, tourSteps, previousIndex, -1);
        })();
      },
    });
    driverRef.current = driverObj;
    startingRef.current = false;
    driverObj.drive();
  }, [finishTour]);

  useImperativeHandle(
    ref,
    () => ({
      start: () => {
        void startTour();
      },
    }),
    [startTour],
  );

  useEffect(() => {
    if (!editorAiWorkflowTourAvailability.isEnabled()) return undefined;
    if (editorAiWorkflowTourStorage.readSeen()) return undefined;

    const timeoutId = window.setTimeout(() => {
      void startTour();
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
      driverRef.current?.destroy();
    };
  }, [startTour]);

  return null;
}
