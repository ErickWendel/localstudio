import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import { editorAiWorkflowTourAvailability } from './editorAiWorkflowTourAvailability';
import { editorAiWorkflowTourSelectors } from './editorAiWorkflowTourSelectors';
import { editorAiWorkflowTourStorage } from './editorAiWorkflowTourStorage';

export interface EditorAiWorkflowTourHandle {
  start: () => void;
}

interface EditorAiWorkflowTourProps {
  onCloseTourSurfaces: () => void;
  onOpenAiTools: () => void;
  onOpenSettings: () => void;
  onOpenMirrorSettings: () => void;
  ref?: Ref<EditorAiWorkflowTourHandle>;
}

interface EditorAiWorkflowTourStep extends DriveStep {
  autoAdvanceMs?: number | undefined;
  id: string;
  prepare?: (() => Promise<void> | void) | undefined;
}

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

async function prepareStep(step: EditorAiWorkflowTourStep) {
  await step.prepare?.();
  await waitForTourPaint();
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
    if (!resolveStepElement(nextStep)) continue;

    activeDriver.moveTo(stepIndex);
    await waitForTourPaint();
    activeDriver.refresh();
    return true;
  }

  return false;
}

function createTourSteps({
  onCloseTourSurfaces,
  onOpenAiTools,
  onOpenSettings,
  onOpenMirrorSettings,
}: Omit<EditorAiWorkflowTourProps, 'ref'>): EditorAiWorkflowTourStep[] {
  const selectors = editorAiWorkflowTourSelectors;
  return [
    {
      id: 'open-ai-tools',
      autoAdvanceMs: 1600,
      element: tourSelector(selectors.aiToolsTab),
      prepare: async () => {
        onCloseTourSurfaces();
        collapseDocumentMenus();
        await waitForTourPaint();
      },
      popover: {
        title: 'Open AI Tools',
        description:
          'Start from the collapsed tools rail. The setup lives in AI Tools because every advanced workflow depends on these local features.',
        side: 'right',
        align: 'center',
      },
    },
    {
      id: 'prepare-ai-features',
      element: firstTourElement(selectors.aiFeatureSetup, selectors.aiToolsPanel),
      prepare: async () => {
        await openAiToolsForTour({
          fallbackOpenerId: selectors.aiToolsTab,
          onOpenAiTools,
          panelId: selectors.aiToolsPanel,
        });
      },
      popover: {
        title: 'Prepare the AI runtime',
        description:
          'Start here before generating slides or images. Download all required browser models once, then leave this tab while the downloads finish.',
        side: 'right',
        align: 'start',
      },
    },
    {
      id: 'create-image-workflow',
      element: tourSelector(selectors.promptWorkflow),
      popover: {
        title: 'Create images from the prompt bar',
        description:
          'With Create image active, the prompt bar turns text into generated media for the current deck.',
        side: 'top',
        align: 'center',
      },
    },
    {
      id: 'create-image-examples',
      element: tourSelector(selectors.promptExamples),
      popover: {
        title: 'Use the prompt recipes',
        description:
          'These chips give users safe starting points while they learn what the local image model responds to.',
        side: 'top',
        align: 'center',
      },
    },
    {
      id: 'prompt-to-slide-mode',
      element: tourSelector(selectors.promptCreateImageToken),
      popover: {
        title: 'Switch back to slide prompts',
        description:
          'Remove the Create image token to turn this same composer into prompt-to-slide mode.',
        side: 'top',
        align: 'center',
      },
    },
    {
      id: 'prompt-submit',
      element: tourSelector(selectors.promptSubmitActions),
      popover: {
        title: 'Generate or stop from here',
        description:
          'Submit starts the selected AI workflow. The same control area becomes Stop while generation is running.',
        side: 'top',
        align: 'end',
      },
    },
    {
      id: 'import-powerpoint',
      element: tourSelector(selectors.fileMenuButton),
      prepare: async () => {
        onCloseTourSurfaces();
        collapseDocumentMenus();
        await waitForTourPaint();
      },
      popover: {
        title: 'Open the File menu',
        description:
          'PowerPoint import starts from File. This keeps import, export, storage, and sharing actions in one predictable place.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      id: 'open-import-menu',
      element: tourSelector(selectors.fileImportMenuItem),
      prepare: async () => {
        await ensureTargetAvailable(selectors.fileImportMenuItem, selectors.fileMenuButton);
      },
      popover: {
        title: 'Choose Import',
        description: 'Import groups the ways to bring existing work into LocalStudio.',
        side: 'right',
        align: 'start',
      },
    },
    {
      id: 'choose-powerpoint',
      element: tourSelector(selectors.fileImportPptxItem),
      prepare: async () => {
        await ensureTargetAvailable(selectors.fileImportMenuItem, selectors.fileMenuButton);
        await ensureTargetAvailable(selectors.fileImportPptxItem, selectors.fileImportMenuItem);
      },
      popover: {
        title: 'Bring in an existing deck',
        description:
          'Import PowerPoint when users already have real content. It is the fastest path to refining a deck with AI.',
        side: 'right',
        align: 'start',
      },
    },
    {
      id: 'enable-storage',
      element: tourSelector(selectors.storageToggle),
      prepare: async () => {
        collapseDocumentMenus();
        await waitForTourPaint();
      },
      popover: {
        title: 'Enable local storage',
        description:
          'Storage keeps project files available for version history, mirroring, and safer long-running AI workflows.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      id: 'mirror-settings',
      element: tourSelector(selectors.mirrorSettingsFields),
      prepare: async () => {
        onOpenMirrorSettings();
        await waitForTourPaint();
      },
      popover: {
        title: 'Configure S3-compatible mirroring',
        description:
          'Add the S3-compatible endpoint, bucket, and keys here, then test the connection before sharing from remote storage.',
        side: 'left',
        align: 'start',
      },
    },
    {
      id: 'mirror-actions',
      element: tourSelector(selectors.mirrorSettingsActions),
      popover: {
        title: 'Test, enable, and save',
        description:
          'These actions make mirroring explicit: verify the connection, enable sync, then save the settings.',
        side: 'left',
        align: 'end',
      },
    },
    {
      id: 'open-settings',
      element: tourSelector(selectors.settingsMediaRow),
      prepare: async () => {
        onCloseTourSurfaces();
        onOpenSettings();
        await waitForTourPaint();
      },
      popover: {
        title: 'Open media integrations',
        description:
          'Settings is where external provider keys live. Choose Media integrations to connect stock image and GIF search.',
        side: 'left',
        align: 'center',
      },
    },
    {
      id: 'media-integrations',
      element: tourSelector(selectors.mediaIntegrationsPanel),
      prepare: async () => {
        await ensureTargetAvailable(selectors.settingsMediaRow, selectors.footerSettings);
        await clickWhenAvailable(selectors.settingsMediaRow);
        await waitForTourPaint();
      },
      popover: {
        title: 'Connect stock media',
        description:
          'Unsplash and GIPHY keys unlock the stock image and GIF searches in the Elements workflow.',
        side: 'left',
        align: 'start',
      },
    },
    {
      id: 'unsplash-and-giphy',
      element: tourSelector(selectors.unsplashConfig),
      popover: {
        title: 'Paste provider keys',
        description:
          'Unsplash powers still images. GIPHY sits just below for animated GIFs and video-backed GIF imports.',
        side: 'left',
        align: 'center',
      },
    },
    {
      id: 'save-media-integrations',
      element: tourSelector(selectors.mediaIntegrationsActions),
      popover: {
        title: 'Save the media setup',
        description:
          'Provider keys stay in this browser profile, keeping demos and local work self-contained.',
        side: 'left',
        align: 'end',
      },
    },
  ];
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
  const autoAdvanceTimeoutRef = useRef<number | undefined>(undefined);
  const autoAdvancedStepIdsRef = useRef<Set<string>>(new Set());
  const startingRef = useRef(false);

  useEffect(() => {
    callbacksRef.current = {
      onCloseTourSurfaces,
      onOpenAiTools,
      onOpenMirrorSettings,
      onOpenSettings,
    };
  }, [onCloseTourSurfaces, onOpenAiTools, onOpenMirrorSettings, onOpenSettings]);

  const clearAutoAdvanceTimeout = useCallback(() => {
    if (autoAdvanceTimeoutRef.current === undefined) return;
    window.clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = undefined;
  }, []);

  const scheduleAutoAdvance = useCallback((
    activeDriver: Driver,
    tourSteps: EditorAiWorkflowTourStep[],
    activeIndex: number,
  ) => {
    const activeStep = tourSteps[activeIndex];
    if (!activeStep?.autoAdvanceMs) return;
    if (autoAdvancedStepIdsRef.current.has(activeStep.id)) return;
    clearAutoAdvanceTimeout();
    autoAdvancedStepIdsRef.current.add(activeStep.id);

    autoAdvanceTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        if (!activeDriver.isActive()) return;
        await moveToAvailableStep(activeDriver, tourSteps, activeIndex + 1, 1);
      })();
    }, activeStep.autoAdvanceMs);
  }, [clearAutoAdvanceTimeout]);

  const finishTour = useCallback(
    (activeDriver: Driver) => {
      editorAiWorkflowTourStorage.writeSeen();
      clearAutoAdvanceTimeout();
      autoAdvancedStepIdsRef.current.clear();
      collapseDocumentMenus();
      callbacksRef.current.onCloseTourSurfaces();
      activeDriver.destroy();
    },
    [clearAutoAdvanceTimeout],
  );

  const startTour = useCallback(async () => {
    if (!editorAiWorkflowTourAvailability.isEnabled()) return;
    if (startingRef.current || driverRef.current?.isActive()) return;

    startingRef.current = true;
    autoAdvancedStepIdsRef.current.clear();
    const tourSteps = createTourSteps({
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
        clearAutoAdvanceTimeout();
        autoAdvancedStepIdsRef.current.clear();
        collapseDocumentMenus();
        callbacksRef.current.onCloseTourSurfaces();
        driverRef.current = undefined;
      },
      onHighlighted: (_element, _step, { driver: activeDriver }) => {
        const activeIndex = activeDriver.getActiveIndex() ?? 0;
        scheduleAutoAdvance(activeDriver, tourSteps, activeIndex);
      },
      onNextClick: () => {
        void (async () => {
          clearAutoAdvanceTimeout();
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
          clearAutoAdvanceTimeout();
          const previousIndex = Math.max(0, (driverObj.getActiveIndex() ?? 0) - 1);
          await moveToAvailableStep(driverObj, tourSteps, previousIndex, -1);
        })();
      },
    });
    driverRef.current = driverObj;
    startingRef.current = false;
    driverObj.drive();
    scheduleAutoAdvance(driverObj, tourSteps, 0);
  }, [clearAutoAdvanceTimeout, finishTour, scheduleAutoAdvance]);

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
      clearAutoAdvanceTimeout();
      driverRef.current?.destroy();
    };
  }, [clearAutoAdvanceTimeout, startTour]);

  return null;
}
