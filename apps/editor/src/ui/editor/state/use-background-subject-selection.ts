import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppServices } from '../../../app/composition';
import type { ModelState } from '../../../services/contracts/interfaces';
import { modelSetupService } from '../../../services/model-setup/modelSetupService';
import type { ProjectDocument } from '../../../domain/documents/model';
import { editorViewModelRuntime } from './editorViewModelRuntime';

const IMAGE_EDITING_MODEL_REQUIRED_MESSAGE = 'You must download the image editing tools first.';
const BACKGROUND_PREVIEW_DEBOUNCE_MS = 120;

interface BackgroundPreviewState {
  elementId: string;
  maskUrl?: string;
  pending: boolean;
  score?: number;
}

interface BackgroundPreparationState {
  elementId: string;
  progress: number;
  status: 'preparing' | 'ready' | 'failed';
}

interface BackgroundSelectionPoint {
  x: number;
  y: number;
  positive: boolean;
}

interface UseBackgroundSubjectSelectionOptions {
  backgroundRemovalService: AppServices['backgroundRemovalService'];
  commitProject: (
    updater: (currentProject: ProjectDocument) => ProjectDocument,
    options?: { selectedElementIds?: string[] },
  ) => void;
  modelStates: ModelState[];
  processingElementIds: string[];
  project: ProjectDocument;
  selectedElementIds: string[];
  setActiveTab: (tab: 'ai-tools') => void;
  setProcessingElementIds: Dispatch<SetStateAction<string[]>>;
}

function getPreviewLoadingState(
  elementId: string,
  currentPreview: BackgroundPreviewState | undefined,
): BackgroundPreviewState {
  const shouldKeepCurrentPreview = currentPreview?.elementId === elementId;
  return {
    elementId,
    pending: true,
    ...(shouldKeepCurrentPreview && currentPreview.maskUrl
      ? { maskUrl: currentPreview.maskUrl }
      : {}),
    ...(shouldKeepCurrentPreview && currentPreview.score !== undefined
      ? { score: currentPreview.score }
      : {}),
  };
}

export function useBackgroundSubjectSelection({
  backgroundRemovalService,
  commitProject,
  modelStates,
  processingElementIds,
  project,
  selectedElementIds,
  setActiveTab,
  setProcessingElementIds,
}: UseBackgroundSubjectSelectionOptions) {
  const [backgroundSelectionMode, setBackgroundSelectionMode] = useState(false);
  const [backgroundSelectionNotice, setBackgroundSelectionNotice] = useState<string | undefined>();
  const [backgroundPreview, setBackgroundPreview] = useState<BackgroundPreviewState | undefined>();
  const [backgroundPreparation, setBackgroundPreparation] = useState<
    BackgroundPreparationState | undefined
  >();
  const [, setBackgroundSelectionPoints] = useState<Record<string, BackgroundSelectionPoint[]>>({});
  const backgroundSelectionPointsRef = useRef<Record<string, BackgroundSelectionPoint[]>>({});
  const backgroundPreviewTimeoutRef = useRef<number | undefined>(undefined);
  const backgroundPreviewSequenceRef = useRef(0);
  const backgroundPreparationSequenceRef = useRef(0);

  useEffect(
    () => () => {
      if (backgroundPreviewTimeoutRef.current !== undefined) {
        window.clearTimeout(backgroundPreviewTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const imageEditingModel = modelStates.find(
      (state) => state.id === modelSetupService.IMAGE_EDITING_MODEL_ID,
    );
    if (imageEditingModel?.status === 'ready') {
      setBackgroundSelectionNotice(undefined);
    }
  }, [modelStates]);

  function clearBackgroundPreview() {
    backgroundPreviewSequenceRef.current += 1;
    if (backgroundPreviewTimeoutRef.current !== undefined) {
      window.clearTimeout(backgroundPreviewTimeoutRef.current);
      backgroundPreviewTimeoutRef.current = undefined;
    }
    setBackgroundPreview(undefined);
  }

  function clearBackgroundPreparation() {
    backgroundPreparationSequenceRef.current += 1;
    setBackgroundPreparation(undefined);
  }

  function clearBackgroundSelectionPoints(elementId?: string) {
    if (!elementId) {
      backgroundSelectionPointsRef.current = {};
      setBackgroundSelectionPoints({});
      return;
    }
    const { [elementId]: removed, ...remainingPoints } = backgroundSelectionPointsRef.current;
    void removed;
    backgroundSelectionPointsRef.current = remainingPoints;
    setBackgroundSelectionPoints(remainingPoints);
  }

  function isBackgroundPreparationReady(elementId: string) {
    return (
      backgroundPreparation?.elementId === elementId && backgroundPreparation.status === 'ready'
    );
  }

  function cancelBackgroundSelectionMode() {
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
  }

  function prepareBackgroundSelection(elementId: string) {
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;

    const sequence = backgroundPreparationSequenceRef.current + 1;
    backgroundPreparationSequenceRef.current = sequence;
    setBackgroundPreparation({ elementId, progress: 4, status: 'preparing' });

    void (async () => {
      try {
        await backgroundRemovalService.prepareBackgroundRemoval(asset, {
          onProgress: (progress) => {
            if (backgroundPreparationSequenceRef.current !== sequence) return;
            setBackgroundPreparation({
              elementId,
              progress: Math.max(4, Math.min(100, Math.round(progress))),
              status: progress >= 100 ? 'ready' : 'preparing',
            });
          },
        });
        if (backgroundPreparationSequenceRef.current !== sequence) return;
        setBackgroundPreparation({ elementId, progress: 100, status: 'ready' });
      } catch {
        if (backgroundPreparationSequenceRef.current !== sequence) return;
        setBackgroundPreparation({ elementId, progress: 0, status: 'failed' });
      }
    })();
  }

  function toggleBackgroundSelectionMode() {
    const element = project.elements[selectedElementIds[0] ?? ''];
    if (element?.type !== 'image') return;
    if (processingElementIds.includes(element.id)) return;
    if (backgroundSelectionMode) {
      setBackgroundSelectionMode(false);
      setBackgroundSelectionNotice(undefined);
      clearBackgroundPreview();
      clearBackgroundPreparation();
      clearBackgroundSelectionPoints(element.id);
      return;
    }

    const imageEditingModel = modelStates.find(
      (state) => state.id === modelSetupService.IMAGE_EDITING_MODEL_ID,
    );
    if (imageEditingModel?.status !== 'ready') {
      setActiveTab('ai-tools');
      setBackgroundSelectionNotice(IMAGE_EDITING_MODEL_REQUIRED_MESSAGE);
      return;
    }

    setBackgroundSelectionNotice(undefined);
    setBackgroundSelectionMode(true);
    clearBackgroundSelectionPoints(element.id);
    prepareBackgroundSelection(element.id);
  }

  function getBackgroundSelectionPointSet(
    elementId: string,
    point: { x: number; y: number },
    positive: boolean,
  ) {
    return [...(backgroundSelectionPointsRef.current[elementId] ?? []), { ...point, positive }];
  }

  function setBackgroundSelectionPointSet(elementId: string, points: BackgroundSelectionPoint[]) {
    backgroundSelectionPointsRef.current = {
      ...backgroundSelectionPointsRef.current,
      [elementId]: points,
    };
    setBackgroundSelectionPoints(backgroundSelectionPointsRef.current);
  }

  function previewBackgroundSubject(elementId: string, subjectPoint: { x: number; y: number }) {
    if (!backgroundSelectionMode || processingElementIds.includes(elementId)) return;
    if (!isBackgroundPreparationReady(elementId)) return;
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;

    const sequence = backgroundPreviewSequenceRef.current + 1;
    backgroundPreviewSequenceRef.current = sequence;
    if (backgroundPreviewTimeoutRef.current !== undefined) {
      window.clearTimeout(backgroundPreviewTimeoutRef.current);
    }
    const points = getBackgroundSelectionPointSet(elementId, subjectPoint, true);
    setBackgroundPreview((currentPreview) => getPreviewLoadingState(elementId, currentPreview));

    backgroundPreviewTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await backgroundRemovalService.previewBackgroundMask(asset, { points });
          if (backgroundPreviewSequenceRef.current !== sequence) return;
          setBackgroundPreview({
            elementId,
            maskUrl: result.maskUrl,
            pending: false,
            score: result.score,
          });
        } catch {
          if (backgroundPreviewSequenceRef.current !== sequence) return;
          setBackgroundPreview((currentPreview) =>
            currentPreview?.elementId === elementId
              ? { ...currentPreview, pending: false }
              : currentPreview,
          );
        }
      })();
    }, BACKGROUND_PREVIEW_DEBOUNCE_MS);
  }

  function refineBackgroundSubject(elementId: string, subjectPoint: { x: number; y: number }) {
    if (!backgroundSelectionMode || processingElementIds.includes(elementId)) return;
    if (!isBackgroundPreparationReady(elementId)) return;
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;
    const points = getBackgroundSelectionPointSet(elementId, subjectPoint, true);
    setBackgroundSelectionPointSet(elementId, points);
    const sequence = backgroundPreviewSequenceRef.current + 1;
    backgroundPreviewSequenceRef.current = sequence;
    if (backgroundPreviewTimeoutRef.current !== undefined) {
      window.clearTimeout(backgroundPreviewTimeoutRef.current);
      backgroundPreviewTimeoutRef.current = undefined;
    }
    setBackgroundPreview((currentPreview) => getPreviewLoadingState(elementId, currentPreview));

    void (async () => {
      try {
        const result = await backgroundRemovalService.previewBackgroundMask(asset, { points });
        if (backgroundPreviewSequenceRef.current !== sequence) return;
        setBackgroundPreview({
          elementId,
          maskUrl: result.maskUrl,
          pending: false,
          score: result.score,
        });
      } catch {
        if (backgroundPreviewSequenceRef.current !== sequence) return;
        setBackgroundPreview({ elementId, pending: false });
      }
    })();
  }

  async function pickBackgroundSubject(elementId: string, subjectPoint: { x: number; y: number }) {
    if (processingElementIds.includes(elementId)) return;
    if (!isBackgroundPreparationReady(elementId)) return;
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;

    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    const points = getBackgroundSelectionPointSet(elementId, subjectPoint, true);
    clearBackgroundSelectionPoints(elementId);
    setProcessingElementIds((currentIds) =>
      currentIds.includes(elementId) ? currentIds : [...currentIds, elementId],
    );
    await editorViewModelRuntime.waitForNextPaint();

    try {
      const result = await backgroundRemovalService.removeBackground(asset, { points });
      commitProject(
        (currentProject) => ({
          ...currentProject,
          assets: {
            ...currentProject.assets,
            [result.asset.id]: result.asset,
          },
          elements: {
            ...currentProject.elements,
            [elementId]: {
              ...element,
              assetId: result.asset.id,
              ...(result.bounds
                ? {
                    x: element.x + element.width * result.bounds.x,
                    y: element.y + element.height * result.bounds.y,
                    width: Math.max(1, element.width * result.bounds.width),
                    height: Math.max(1, element.height * result.bounds.height),
                  }
                : {}),
            },
          },
          updatedAt: new Date().toISOString(),
        }),
        { selectedElementIds: [elementId] },
      );
    } finally {
      setProcessingElementIds((currentIds) => currentIds.filter((id) => id !== elementId));
    }
  }

  return {
    backgroundPreparation,
    backgroundPreview,
    backgroundSelectionMode,
    backgroundSelectionNotice,
    cancelBackgroundSelectionMode,
    pickBackgroundSubject,
    previewBackgroundSubject,
    refineBackgroundSubject,
    toggleBackgroundSelectionMode,
  };
}
