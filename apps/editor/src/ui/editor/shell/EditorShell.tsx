import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { localStudioAnalyticsConfig } from '@localstudio/analytics-config/config';
import type Konva from 'konva';
import type { AppServices } from '../../../app/composition';
import { placeholderImage } from '../../../domain/assets/placeholderImage';
import type { ProjectDocument, TranscriptRecording } from '../../../domain/documents/model';
import { pageVisibility } from '../../../domain/documents/pageVisibility';
import type { ShareMetadata, SharePublishProgress } from '../../../services/contracts/interfaces';
import { analyticsModelProperties } from '../../../services/analytics/analyticsModelProperties';
import {
  authoringAutomationController,
  type AuthoringProgressReporter,
} from '../../../services/automation/authoringAutomationController';
import type { AuthoringOperationStatus } from '../../../services/automation/authoringOperationRegistry';
import {
  createAuthoringVisualCapability,
  type AuthoringExportInput,
  type AuthoringRenderedExportResult,
} from '../../../services/automation/authoringVisualCapability';
import { createAuthoringAutomationDelegate } from '../../../services/automation/createAuthoringAutomationDelegate';
import { createAuthoringAssetCapabilities } from '../../../services/automation/createAuthoringAssetCapabilities';
import { deckLocalizationCapability } from '../../../services/automation/deckLocalizationCapability';
import { authoringRevision } from '../../../services/automation/getAuthoringSlideRevision';
import { localSlideDescriptionGenerator } from '../../../services/automation/localSlideDescriptionGenerator';
import { PowerPointUrlImportService } from '../../../services/automation/powerPointUrlImportService';
import { imageGenerationModel } from '../../../services/image-generation/imageGenerationModel';
import {
  WebMcpToolAdapter,
  type WebMcpDemoWindow,
} from '../../../services/webmcp/webMcpToolAdapter';
import { EditorFooter } from './EditorFooter';
import { ImageExportPanel, type ImageExportOptions } from '../panels/ImageExportPanel';
import { MediaImportProgressOverlay } from './MediaImportProgressOverlay';
import { PresentationImportProgressOverlay } from './PresentationImportProgressOverlay';
import { PowerPointFontReplacementDialog } from './PowerPointFontReplacementDialog';
import { PowerPointFontWarningDialog } from './PowerPointFontWarningDialog';
import { MediaIntegrationSettingsPanel } from '../panels/MediaIntegrationSettingsPanel';
import { MirrorSettingsPanel } from '../panels/MirrorSettingsPanel';
import { PagesPanel } from '../panels/PagesPanel';
import { ProjectVideoPreloader } from '../media/ProjectVideoPreloader';
import { localMediaImportConfig } from '../media/localMediaImportConfig';
import { movieStartPlayback } from '../media/movieStartPlayback';
import { PromptBar } from '../prompting/PromptBar';
import type { PromptModelControlState } from '../prompting/PromptModelControl';
import { RemoteImportPanel } from '../panels/RemoteImportPanel';
import { CanvasWorkspace } from '../canvas/CanvasWorkspace';
import { ScrollingCanvasWorkspace } from '../canvas/ScrollingCanvasWorkspace';
import { SettingsPanel } from '../panels/SettingsPanel';
import { VersionHistoryPanel } from '../panels/VersionHistoryPanel';
import { presentationMovieControls, type MovieHoldState } from '../media/presentationMovieControls';
import { useEditorViewModel, type OperationNoticeState } from '../state/useEditorViewModel';
import { editorViewModelProject } from '../state/editorViewModelProject';
import { SharePanel } from '../../share/SharePanel';
import { copyShareText } from '../../share/shareClipboard';
import {
  KeyboardShortcutsDialog,
  type KeyboardShortcutAction,
} from '../../components/KeyboardShortcutsDialog';
import { editorShellBrowserUtils } from '../browser/editorShellBrowserUtils';
import { BrowserPresenterSessionService } from '../../../services/presenter/presenterSessionService';
import type {
  PresenterRemoteSessionMetadata,
  PresenterStatePayload,
} from '../../../services/presenter/presenterSessionTypes';
import { PresenterRemotePanel } from '../../presenter/PresenterRemotePanel';
import { EditorAiWorkflowTour } from '../tour/EditorAiWorkflowTour';
import type { EditorAiWorkflowTourHandle } from '../tour/editorAiWorkflowTourTypes';
import { AudienceFullscreenPrompt } from './AudienceFullscreenPrompt';
import { EditorLeftPanelSurface } from './EditorLeftPanelSurface';
import { EditorMobileUnavailable } from './EditorMobileUnavailable';
import { EditorToolbarSurface } from './EditorToolbarSurface';
import { editorImageExport } from './editor-image-export';
import type { ImageExportFrame } from './editor-image-export';
import { editorShortcutActions } from './editor-shortcut-actions';
import { PresentationSlideNavigator } from './PresentationSlideNavigator';
import { SpeakerNotesEditor } from './SpeakerNotesEditor';
import { createProjectForSelectedShareRecording } from './createProjectForSelectedShareRecording';
import { WebMcpOperationNotice } from './WebMcpOperationNotice';

interface EditorShellProps {
  services: AppServices;
}

const editorMobileViewportQuery = '(max-width: 760px)';
const postHogEvents = localStudioAnalyticsConfig.postHog.events;

function getModelControlPreparation(status: string | undefined, progress: number | undefined) {
  if (status === 'downloading') {
    return { availability: 'downloading', progress: progress ?? 0, status: 'downloading' as const };
  }
  if (status === 'ready') {
    return { availability: 'ready', progress: 100, status: 'ready' as const };
  }
  if (status === 'failed') {
    return { availability: 'downloadable', progress: progress ?? 0, status: 'failed' as const };
  }
  return { availability: 'downloadable', progress: 0, status: 'idle' as const };
}

function isMobileEditorViewport() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (editorShellBrowserUtils.isWebMcpEnabled()) return false;
  return window.matchMedia(editorMobileViewportQuery).matches;
}

function getProjectPublishSignature(project: ProjectDocument) {
  return `${project.id}:${project.updatedAt}`;
}

export function EditorShell({ services }: EditorShellProps) {
  const [mobileEditorUnavailable, setMobileEditorUnavailable] = useState(isMobileEditorViewport);

  useEffect(() => {
    if (editorShellBrowserUtils.isWebMcpEnabled()) return undefined;
    if (!window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia(editorMobileViewportQuery);
    function syncMobileEditorAvailability(event: MediaQueryList | MediaQueryListEvent) {
      setMobileEditorUnavailable(event.matches);
    }

    syncMobileEditorAvailability(mediaQuery);
    mediaQuery.addEventListener('change', syncMobileEditorAvailability);
    return () => {
      mediaQuery.removeEventListener('change', syncMobileEditorAvailability);
    };
  }, []);

  if (mobileEditorUnavailable) {
    return <EditorMobileUnavailable />;
  }

  return <EditorDesktopShell services={services} />;
}

function EditorDesktopShell({ services }: EditorShellProps) {
  const vm = useEditorViewModel(services);
  const authoringVmRef = useRef(vm);
  const authoringVisualRuntimeRef = useRef<
    | {
        exportRendered(
          project: ProjectDocument,
          input: AuthoringExportInput,
          report: AuthoringProgressReporter,
        ): Promise<AuthoringRenderedExportResult>;
        focusSlide(pageId: string): Promise<void>;
      }
    | undefined
  >(undefined);
  const presenterTranscriptionLanguage =
    vm.translationLanguageOptions.find(
      (language) => language.code === vm.translationTargetLanguage,
    ) ?? vm.activeSlideLanguage;
  const automationDelegateRef = useRef(vm.automation);
  const prepareProjectFontsForPublicShareRef = useRef(vm.prepareProjectFontsForPublicShare);
  const movieHoldStateRef = useRef<MovieHoldState | undefined>(undefined);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [designFontFocusKey, setDesignFontFocusKey] = useState(0);
  const [speakerNotesOpen, setSpeakerNotesOpen] = useState(false);
  const [audienceFullscreenPromptOpen, setAudienceFullscreenPromptOpen] = useState(false);
  const [audiencePromptMode, setAudiencePromptMode] = useState<'fullscreen' | 'window'>(
    'fullscreen',
  );
  const [windowedPresentationActive, setWindowedPresentationActive] = useState(false);
  const [windowedExitHintVisible, setWindowedExitHintVisible] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [fontReplacementOpen, setFontReplacementOpen] = useState(false);
  const [slideNavigatorOpen, setSlideNavigatorOpen] = useState(false);
  const [slideNavigatorIndex, setSlideNavigatorIndex] = useState(0);
  const [presentationPaused, setPresentationPaused] = useState(false);
  const [presentationBlankScreen, setPresentationBlankScreen] = useState<
    'black' | 'white' | undefined
  >();
  const [presentationCursorHidden, setPresentationCursorHidden] = useState(false);
  const [slideNumberVisible, setSlideNumberVisible] = useState(false);
  const [presenterSessionId, setPresenterSessionId] = useState<string | undefined>();
  const [presenterRemoteSession, setPresenterRemoteSession] = useState<
    PresenterRemoteSessionMetadata | undefined
  >();
  const [presenterRemotePanelOpen, setPresenterRemotePanelOpen] = useState(false);
  const [presenterRemoteUnavailable, setPresenterRemoteUnavailable] = useState(false);
  const [presenterRemoteStreamPeerId, setPresenterRemoteStreamPeerId] = useState<
    string | undefined
  >();
  const [remotePresenterActive, setRemotePresenterActive] = useState(false);
  const [presenterViewError, setPresenterViewError] = useState<string | undefined>();
  const [imageExportPanelOpen, setImageExportPanelOpen] = useState(false);
  const [imageExportNotice, setImageExportNotice] = useState<OperationNoticeState | undefined>();
  const [webMcpOperationStatus, setWebMcpOperationStatus] = useState<
    AuthoringOperationStatus | undefined
  >();
  const [imageExportRender, setImageExportRender] = useState<
    { frame: ImageExportFrame; project: ProjectDocument } | undefined
  >();
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareMetadata, setShareMetadata] = useState<ShareMetadata | undefined>();
  const [sharePublishProgress, setSharePublishProgress] = useState<
    SharePublishProgress | undefined
  >();
  const stageRef = useRef<Konva.Stage>(null);
  const imageExportStageRef = useRef<Konva.Stage>(null);
  const renderedExportInProgressRef = useRef(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const slideFrameRef = useRef<HTMLDivElement>(null);
  const windowedExitHintTimerRef = useRef<number | undefined>(undefined);
  const presenterSessionServiceRef = useRef<BrowserPresenterSessionService | undefined>(undefined);
  const presenterRemotePanelRef = useRef<HTMLDivElement>(null);
  const aiWorkflowTourRef = useRef<EditorAiWorkflowTourHandle>(null);
  const imageExportNoticeTimeoutRef = useRef<number | undefined>(undefined);
  const presenterFullscreenEnteredRef = useRef(false);
  const pendingShareAfterLocalSaveRef = useRef(false);
  const pendingPresenterRecordingsRef = useRef(
    new Map<string, { chunks: Blob[]; recording: TranscriptRecording }>(),
  );
  const lastPublishedShareSelectionRef = useRef<
    | {
        projectSignature: string;
        selectedRecordingId?: string | undefined;
        shareId: string;
      }
    | undefined
  >(undefined);
  const sharePublishPromiseRef = useRef<
    | {
        promise: Promise<ShareMetadata>;
        selectedRecordingId?: string | undefined;
      }
    | undefined
  >(undefined);
  const toolbarImageInputRef = useRef<HTMLInputElement>(null);
  const hasSelection = vm.selection.elementIds.length > 0;
  const isHistoryReadOnly = vm.versionHistoryOpen;
  const activePageIndex = Math.max(
    0,
    vm.project.pages.findIndex((page) => page.id === vm.activePageId),
  );
  const activePage = vm.project.pages[activePageIndex];
  const visiblePages = pageVisibility.getVisiblePages(vm.project);
  const visiblePageCount = visiblePages.length;
  const browserPresentationActive = vm.isFullscreen || windowedPresentationActive;
  const activeVisiblePageIndex = Math.max(
    0,
    visiblePages.findIndex((page) => page.id === vm.activePageId),
  );
  const deckTranslationStatus = vm.deckTranslationProgress
    ? `Translating ${vm.deckTranslationProgress.currentPageName} · ${vm.deckTranslationProgress.completedPages}/${vm.deckTranslationProgress.totalPages}`
    : undefined;
  const publicSharingConfigured = vm.hasMirrorConfig;
  const lastMirrorSyncTime = Date.parse(vm.mirrorState.lastSyncedAt ?? '');
  const mirrorHasCurrentProject =
    vm.mirrorState.enabled &&
    vm.mirrorState.status === 'synced' &&
    Number.isFinite(lastMirrorSyncTime) &&
    lastMirrorSyncTime >= Date.parse(vm.project.updatedAt);
  const publicSharingAvailable =
    publicSharingConfigured && (Boolean(shareMetadata?.shareId) || mirrorHasCurrentProject);
  const publicSharingUnavailableReason = 'Public links cannot be created without remote storage.';
  const hasDirectoryPersistence = services.persistenceMode === 'directory';
  const shareRecordingOptions = Object.values(vm.project.recordings ?? {})
    .filter((recording) => recording.audio.objectUrl && recording.segments.length > 0)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .map((recording) => ({
      id: recording.id,
      label: recording.name,
      segmentCount: recording.segments.length,
    }));
  const latestShareRecordingId = shareRecordingOptions[0]?.id;
  const persistTranscriptRecording = vm.addTranscriptRecording;
  const imageGenerationState = vm.modelStates.find(
    (model) => model.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
  );
  const imageGenerationModelControlState: PromptModelControlState = {
    label: 'Image generation model',
    preparation: {
      ...getModelControlPreparation(imageGenerationState?.status, imageGenerationState?.progress),
      estimatedRemainingMs: imageGenerationState?.estimatedRemainingMs,
      loadedBytes: imageGenerationState?.loadedBytes,
      totalBytes: imageGenerationState?.totalBytes,
    },
    options: [
      {
        compatibility:
          imageGenerationState?.status === 'unavailable' ? 'incompatible' : 'compatible',
        id: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
        label: imageGenerationModel.IMAGE_GENERATION_DISPLAY_NAME,
        modelId: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
        readiness: imageGenerationState?.status ?? 'needs-download',
        selected: true,
      },
    ],
  };
  const promptModelControlState: PromptModelControlState = {
    label: 'Prompt model',
    preparation: vm.promptPreparation,
    options: vm.promptProviderStates,
  };

  const createPresenterStatePayload = useCallback(
    (overrides?: Partial<PresenterStatePayload>): PresenterStatePayload => ({
      activePageId: vm.activePageId,
      animationPreview: vm.animationPreview,
      presenterMode: presenterSessionId || remotePresenterActive ? 'presenting' : 'ready',
      project: vm.project,
      promptModel: {
        options: vm.promptProviderStates,
        preparation: vm.promptPreparation,
      },
      streamPeerId: presenterRemoteStreamPeerId,
      transcriptionLanguage: presenterTranscriptionLanguage,
      ...overrides,
    }),
    [
      presenterRemoteStreamPeerId,
      presenterSessionId,
      presenterTranscriptionLanguage,
      remotePresenterActive,
      vm.activePageId,
      vm.animationPreview,
      vm.project,
      vm.promptPreparation,
      vm.promptProviderStates,
    ],
  );

  const publishCurrentProjectShare = useCallback(
    async (selectedRecordingId?: string) => {
      const inFlightSharePublish = sharePublishPromiseRef.current;
      if (
        inFlightSharePublish &&
        inFlightSharePublish.selectedRecordingId === selectedRecordingId
      ) {
        return inFlightSharePublish.promise;
      }
      if (inFlightSharePublish) {
        await inFlightSharePublish.promise.catch(() => undefined);
      }
      const preparedShare = services.shareService.getProjectShareMetadata(vm.project);
      const shareId = shareMetadata?.shareId ?? preparedShare.shareId;
      setShareMetadata((current) => ({
        ...(current ?? preparedShare),
        shareId,
        status: 'syncing',
      }));

      const publishPromise = (async () => {
        const fontResult = await prepareProjectFontsForPublicShareRef.current();
        return services.shareService.updateShare(
          shareId,
          createProjectForSelectedShareRecording(fontResult.project, selectedRecordingId),
          {
            onProgress: setSharePublishProgress,
          },
        );
      })();
      sharePublishPromiseRef.current = { promise: publishPromise, selectedRecordingId };
      try {
        const nextShare = await publishPromise;
        const selectedRecording = selectedRecordingId
          ? vm.project.recordings?.[selectedRecordingId]
          : undefined;
        if (selectedRecording && !selectedRecording.audio.publicShareAuthorized) {
          persistTranscriptRecording({
            ...selectedRecording,
            audio: { ...selectedRecording.audio, publicShareAuthorized: true },
          });
        }
        lastPublishedShareSelectionRef.current = {
          projectSignature: getProjectPublishSignature(vm.project),
          selectedRecordingId,
          shareId: nextShare.shareId,
        };
        setShareMetadata(nextShare);
        services.analyticsService.capture(postHogEvents.presentationShared, {
          project_name: vm.project.name,
          share_id: nextShare.shareId,
          has_recording: Boolean(selectedRecordingId),
          page_count: vm.project.pages.length,
        });
        return nextShare;
      } catch (error) {
        setShareMetadata((current) => (current ? { ...current, status: 'sync-failed' } : current));
        throw error;
      } finally {
        if (sharePublishPromiseRef.current?.promise === publishPromise) {
          sharePublishPromiseRef.current = undefined;
        }
        setSharePublishProgress(undefined);
      }
    },
    [
      services.analyticsService,
      services.shareService,
      shareMetadata?.shareId,
      persistTranscriptRecording,
      vm.project,
    ],
  );

  function getReusablePublishedShare(
    share: ShareMetadata | undefined,
    selectedRecordingId: string | undefined,
  ): ShareMetadata | undefined {
    if (!share || (share.status !== 'published' && share.status !== 'copied')) return undefined;
    const lastPublishedShareSelection = lastPublishedShareSelectionRef.current;
    if (
      lastPublishedShareSelection?.shareId === share.shareId &&
      lastPublishedShareSelection.selectedRecordingId === selectedRecordingId
    ) {
      return share;
    }
    return undefined;
  }

  const hasPublishedCurrentProjectShare = useCallback(
    (
      share: ShareMetadata | undefined,
      selectedRecordingId: string | undefined,
      project: ProjectDocument,
    ) => {
      if (!share || (share.status !== 'published' && share.status !== 'copied')) return false;
      const lastPublishedShareSelection = lastPublishedShareSelectionRef.current;
      return (
        lastPublishedShareSelection?.shareId === share.shareId &&
        lastPublishedShareSelection.selectedRecordingId === selectedRecordingId &&
        lastPublishedShareSelection.projectSignature === getProjectPublishSignature(project)
      );
    },
    [],
  );

  function exportCurrentPageAsPng() {
    const dataUrl = stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
    if (!dataUrl) return;
    services.exportService.downloadDataUrl(
      dataUrl,
      services.exportService.getPageImageFileName(vm.project, vm.activePageId, 'png'),
    );
  }

  function showImageExportNotice(
    notice: OperationNoticeState | undefined,
    options?: { persistent?: boolean },
  ) {
    if (imageExportNoticeTimeoutRef.current !== undefined) {
      window.clearTimeout(imageExportNoticeTimeoutRef.current);
      imageExportNoticeTimeoutRef.current = undefined;
    }
    setImageExportNotice(notice);
    if (!notice || options?.persistent) return;
    imageExportNoticeTimeoutRef.current = window.setTimeout(() => {
      setImageExportNotice(undefined);
      imageExportNoticeTimeoutRef.current = undefined;
    }, 3500);
  }

  function getImageExportFrames(options: ImageExportOptions): ImageExportFrame[] {
    return editorImageExport.getFrames({
      getPageImageFileName: services.exportService.getPageImageFileName.bind(
        services.exportService,
      ),
      options,
      project: vm.project,
    });
  }

  async function renderImageExportFrame(
    frame: ImageExportFrame,
    format: ImageExportOptions['format'],
    sourceProject = vm.project,
  ) {
    await editorImageExport.preloadFrameImages(sourceProject, frame.pageId);
    setImageExportRender({ frame, project: sourceProject });
    await editorImageExport.waitForNextPaint();
    const dataUrl = imageExportStageRef.current?.toDataURL(
      format === 'jpeg'
        ? { mimeType: 'image/jpeg', pixelRatio: 2, quality: 0.92 }
        : { mimeType: 'image/png', pixelRatio: 2 },
    );
    if (!dataUrl) throw new Error(`Could not render ${frame.fileName}.`);
    return editorImageExport.dataUrlToBytes(dataUrl);
  }

  async function exportRenderedForAutomation(
    project: ProjectDocument,
    input: AuthoringExportInput,
    report: AuthoringProgressReporter,
  ): Promise<AuthoringRenderedExportResult> {
    if (input.format === 'pptx') throw new Error('PowerPoint uses the native export pipeline.');
    if (renderedExportInProgressRef.current) {
      throw new Error('Another rendered export is running.');
    }
    const imageFormat = input.format === 'pdf' ? 'png' : input.format;
    const frames = editorImageExport.getFrames({
      getPageImageFileName: services.exportService.getPageImageFileName.bind(
        services.exportService,
      ),
      options: {
        format: imageFormat,
        includeAnimationFrames: input.includeAnimationFrames ?? false,
        slideRange: 'all',
      },
      project,
    });
    if (frames.length === 0) throw new Error('The presentation has no slides to export.');
    renderedExportInProgressRef.current = true;
    if (input.format === 'pdf') setIsExportingPdf(true);
    else setIsExportingImages(true);
    try {
      const renderedFrames: Array<{ bytes: Uint8Array; frame: ImageExportFrame }> = [];
      for (const [index, frame] of frames.entries()) {
        report({
          stage: 'rendering-slides',
          progress: 10 + Math.round(((index + 1) / frames.length) * 75),
          current: index + 1,
          total: frames.length,
          detail: frame.fileName,
        });
        renderedFrames.push({
          bytes: await renderImageExportFrame(frame, imageFormat, project),
          frame,
        });
      }
      if (input.format === 'pdf') {
        const pages = renderedFrames.map(({ bytes, frame }) => {
          const page = project.pages.find((candidate) => candidate.id === frame.pageId);
          if (!page) throw new Error(`Could not find rendered slide ${frame.pageId}.`);
          return {
            bytes,
            heightPoints: project.pageSizePoints?.height ?? page.height / 2,
            widthPoints: project.pageSizePoints?.width ?? page.width / 2,
          };
        });
        const { pdfExportService } = await import('../../../services/exporting/pdfExportService');
        return {
          blob: await pdfExportService.createBlob(pages, {
            onProgress: (current, total) =>
              report({
                stage: 'assembling-pdf',
                progress: 85 + Math.round((current / total) * 10),
                current,
                total,
              }),
          }),
          frameCount: renderedFrames.length,
          slideCount: project.pages.length,
          warnings: [],
        };
      }
      return {
        blob: editorImageExport.createZipBlob(
          Object.fromEntries(renderedFrames.map(({ bytes, frame }) => [frame.fileName, bytes])),
        ),
        frameCount: renderedFrames.length,
        slideCount: project.pages.length,
        warnings: [],
      };
    } finally {
      setImageExportRender(undefined);
      renderedExportInProgressRef.current = false;
      if (input.format === 'pdf') setIsExportingPdf(false);
      else setIsExportingImages(false);
    }
  }

  async function exportImages(options: ImageExportOptions) {
    if (renderedExportInProgressRef.current) return;
    const frames = getImageExportFrames(options);
    if (frames.length === 0) return;
    renderedExportInProgressRef.current = true;
    setIsExportingImages(true);
    showImageExportNotice(
      {
        detail: `Preparing 1 of ${frames.length}`,
        message: 'Exporting slide images...',
        progress: { current: 1, total: frames.length },
        tone: 'info',
      },
      { persistent: true },
    );

    try {
      const archiveFiles: Record<string, Uint8Array> = {};
      for (const [index, frame] of frames.entries()) {
        showImageExportNotice(
          {
            detail: `${frame.fileName}`,
            message: 'Exporting slide images...',
            progress: { current: index + 1, total: frames.length },
            tone: 'info',
          },
          { persistent: true },
        );
        archiveFiles[frame.fileName] = await renderImageExportFrame(frame, options.format);
      }
      setImageExportRender(undefined);
      services.exportService.downloadBlob(
        editorImageExport.createZipBlob(archiveFiles),
        services.exportService.getImagesArchiveFileName(vm.project),
      );
      setImageExportPanelOpen(false);
      showImageExportNotice({
        message: `Images exported: ${frames.length} file${frames.length === 1 ? '' : 's'}.`,
        tone: 'success',
      });
      services.analyticsService.capture(postHogEvents.presentationExportedImages, {
        slide_count: frames.length,
        format: options.format,
        project_name: vm.project.name,
        page_count: vm.project.pages.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error.';
      showImageExportNotice({ message: `Image export failed: ${message}`, tone: 'error' });
    } finally {
      setImageExportRender(undefined);
      renderedExportInProgressRef.current = false;
      setIsExportingImages(false);
    }
  }

  async function exportPdf() {
    if (renderedExportInProgressRef.current) return;
    const frames = getImageExportFrames({
      format: 'png',
      includeAnimationFrames: false,
      slideRange: 'all',
    });
    if (frames.length === 0) return;
    renderedExportInProgressRef.current = true;
    setIsExportingPdf(true);
    showImageExportNotice(
      {
        detail: `Preparing 1 of ${frames.length}`,
        message: 'Exporting PDF...',
        progress: { current: 1, total: frames.length },
        tone: 'info',
      },
      { persistent: true },
    );

    try {
      const pages = [];
      for (const [index, frame] of frames.entries()) {
        const page = vm.project.pages.find((candidate) => candidate.id === frame.pageId);
        if (!page) continue;
        showImageExportNotice(
          {
            detail: page.name,
            message: 'Exporting PDF...',
            progress: { current: index + 1, total: frames.length },
            tone: 'info',
          },
          { persistent: true },
        );
        pages.push({
          bytes: await renderImageExportFrame(frame, 'png'),
          heightPoints: vm.project.pageSizePoints?.height ?? page.height / 2,
          widthPoints: vm.project.pageSizePoints?.width ?? page.width / 2,
        });
      }
      setImageExportRender(undefined);
      const { pdfExportService } = await import(
        '../../../services/exporting/pdfExportService'
      );
      services.exportService.downloadBlob(
        await pdfExportService.createBlob(pages, {
          onProgress: (current, total) =>
            showImageExportNotice(
              {
                detail: `Assembling ${current} of ${total}`,
                message: 'Exporting PDF...',
                progress: { current, total },
                tone: 'info',
              },
              { persistent: true },
            ),
        }),
        services.exportService.getPdfFileName(vm.project),
      );
      showImageExportNotice({
        message: `PDF exported: ${pages.length} slide${pages.length === 1 ? '' : 's'}.`,
        tone: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error.';
      showImageExportNotice({ message: `PDF export failed: ${message}`, tone: 'error' });
    } finally {
      setImageExportRender(undefined);
      renderedExportInProgressRef.current = false;
      setIsExportingPdf(false);
    }
  }

  function openBlankProjectInNewTab() {
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    url.searchParams.set('newProject', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  async function copyPublicShareLink(selectedRecordingId?: string) {
    const preparedShare =
      getReusablePublishedShare(shareMetadata, selectedRecordingId) ??
      (await publishCurrentProjectShare(selectedRecordingId));
    const copiedShare: ShareMetadata = { ...preparedShare, status: 'copied' };
    setShareMetadata(copiedShare);
    copyShareText(copiedShare.publicUrl);
    services.analyticsService.capture(postHogEvents.shareLinkCopied, {
      project_name: vm.project.name,
      has_recording: Boolean(selectedRecordingId),
      page_count: vm.project.pages.length,
    });
    return copiedShare;
  }

  function continueShareAfterLocalSave() {
    if (!pendingShareAfterLocalSaveRef.current) return;
    pendingShareAfterLocalSaveRef.current = false;
    if (!vm.hasMirrorConfig) {
      setSharePanelOpen(false);
      vm.openMirrorSettings();
      return;
    }
    setSharePanelOpen(true);
  }

  async function openShareWorkflow() {
    setSharePanelOpen(false);
    if (!vm.persistenceEnabled) {
      pendingShareAfterLocalSaveRef.current = true;
      const saved = await vm.setPersistence(true);
      if (saved) continueShareAfterLocalSave();
      return;
    }
    if (!vm.hasMirrorConfig) {
      vm.openMirrorSettings();
      return;
    }
    setSharePanelOpen(true);
  }

  function presentFromSharePanel() {
    setSharePanelOpen(false);
    void vm.toggleFullscreen(workspaceRef.current);
    services.analyticsService.capture(postHogEvents.presentationStartedFullscreen, {
      fromSharePanel: true,
      pageCount: vm.project.pages.length,
    });
  }

  function startPresenterMode(options?: { fromBeginning?: boolean }) {
    const pageId = options?.fromBeginning ? vm.project.pages[0]?.id : vm.activePageId;
    if (!pageId) return;
    vm.playPresentationPreview(pageId);
    void vm.toggleFullscreen(workspaceRef.current);
    services.analyticsService.capture(postHogEvents.presentationStartedFullscreen, {
      fromBeginning: Boolean(options?.fromBeginning),
      pageCount: vm.project.pages.length,
    });
  }

  function getPresenterSessionService() {
    presenterSessionServiceRef.current ??= new BrowserPresenterSessionService();
    return presenterSessionServiceRef.current;
  }

  const closePresenterViewSession = useCallback(() => {
    for (const pendingRecording of pendingPresenterRecordingsRef.current.values()) {
      if (pendingRecording.chunks.length === 0) continue;
      const audioBlob = new Blob(pendingRecording.chunks, {
        type: pendingRecording.recording.audio.mimeType,
      });
      vm.addTranscriptRecording({
        ...pendingRecording.recording,
        audio: {
          ...pendingRecording.recording.audio,
          objectUrl: URL.createObjectURL(audioBlob),
        },
      });
    }
    presenterSessionServiceRef.current?.closePresenterWindow();
    pendingPresenterRecordingsRef.current.clear();
    presenterFullscreenEnteredRef.current = false;
    setWindowedPresentationActive(false);
    setWindowedExitHintVisible(false);
    if (windowedExitHintTimerRef.current !== undefined) {
      window.clearTimeout(windowedExitHintTimerRef.current);
      windowedExitHintTimerRef.current = undefined;
    }
    vm.clearAnimationPreview();
    setAudienceFullscreenPromptOpen(false);
    setPresenterRemoteSession(undefined);
    setPresenterRemotePanelOpen(false);
    setPresenterRemoteUnavailable(false);
    setPresenterRemoteStreamPeerId(undefined);
    setRemotePresenterActive(false);
    setPresenterSessionId(undefined);
  }, [vm]);

  const openPresenterView = useCallback((options?: { audienceMode?: 'fullscreen' | 'window' }) => {
    if (presenterSessionId) return;
    const pageId = vm.activePageId;
    if (!pageId) return;
    const service = getPresenterSessionService();
    const result = service.openPresenterWindow();
    if (result.status === 'blocked') {
      setPresenterViewError('Allow popups to open presenter view.');
      return;
    }
    setPresenterViewError(undefined);
    setPresenterRemoteUnavailable(false);
    setRemotePresenterActive(true);
    setPresenterSessionId(result.sessionId);
    services.analyticsService.capture(postHogEvents.presenterViewOpened, {
      project_name: vm.project.name,
      page_count: vm.project.pages.length,
    });
    void service
      .openRemoteControlSession({
        presenterLabel: navigator.platform || 'Presenter device',
        ttlMs: 16 * 60 * 60 * 1000,
      })
      .then((remoteSession) => {
        setPresenterRemoteSession(remoteSession);
        services.analyticsService.capture(postHogEvents.presenterRemoteOpened, {
          pageCount: vm.project.pages.length,
        });
        service.publishState(
          createPresenterStatePayload({ activePageId: pageId, presenterMode: 'presenting' }),
        );
      })
      .catch(() => {
        setPresenterRemoteUnavailable(true);
        setPresenterRemotePanelOpen(false);
        setPresenterViewError(
          'Remote control is unavailable on this host. Presenter view is still active.',
        );
      });
    presenterFullscreenEnteredRef.current = false;
    setAudiencePromptMode(options?.audienceMode ?? 'fullscreen');
    setAudienceFullscreenPromptOpen(true);
    vm.playPresentationPreview(pageId);
    window.setTimeout(() => {
      service.publishState(
        createPresenterStatePayload({ activePageId: pageId, presenterMode: 'presenting' }),
      );
    }, 0);
  }, [createPresenterStatePayload, presenterSessionId, services.analyticsService, vm]);

  function enterAudienceFullscreen() {
    setAudienceFullscreenPromptOpen(false);
    void vm.toggleFullscreen(workspaceRef.current);
  }

  function startWindowedAudiencePlayback() {
    setAudienceFullscreenPromptOpen(false);
    setWindowedPresentationActive(true);
  }

  const closeWindowedAudiencePlayback = useCallback(() => {
    closePresenterViewSession();
  }, [closePresenterViewSession]);

  function handleWorkspacePointerMove(event: MouseEvent<HTMLElement>) {
    if (!windowedPresentationActive) return;
    if (event.clientY > 56) return;
    setWindowedExitHintVisible(true);
    if (windowedExitHintTimerRef.current !== undefined) {
      window.clearTimeout(windowedExitHintTimerRef.current);
    }
    windowedExitHintTimerRef.current = window.setTimeout(() => {
      setWindowedExitHintVisible(false);
      windowedExitHintTimerRef.current = undefined;
    }, 2200);
  }

  const playPresentationPageAt = useCallback(
    (index: number) => {
      const pageId = vm.project.pages[index]?.id;
      if (!pageId) return false;
      setSlideNavigatorIndex(index);
      vm.playPresentationPreview(pageId);
      return true;
    },
    [vm],
  );

  const playRelativePresentationSlide = useCallback(
    (offset: -1 | 1) => {
      return playPresentationPageAt(activePageIndex + offset);
    },
    [activePageIndex, playPresentationPageAt],
  );

  function getPresentationVideos() {
    const activeSlideRoot =
      workspaceRef.current?.querySelector('.scroll-page-active') ?? slideFrameRef.current;
    return Array.from(
      activeSlideRoot?.querySelectorAll<HTMLVideoElement>('video.canvas-media-element') ?? [],
    );
  }

  const controlPresentationMovies = useCallback((action: 'end' | 'play-toggle' | 'start') => {
    const videos = getPresentationVideos();
    return presentationMovieControls.control(videos, action);
  }, []);

  const advancePresentationPreviewFromUserAction = useCallback(() => {
    movieStartPlayback.playPendingMovieStart(
      slideFrameRef.current,
      vm.project,
      vm.animationPreview,
    );
    vm.advancePresentationPreview();
  }, [vm]);

  const pulsePresentationMovieHold = useCallback((action: 'fast-forward' | 'rewind') => {
    movieHoldStateRef.current = presentationMovieControls.pulse(
      getPresentationVideos(),
      action,
      movieHoldStateRef.current,
    );
  }, []);

  const startPresentationMovieHold = useCallback((action: 'fast-forward' | 'rewind') => {
    movieHoldStateRef.current = presentationMovieControls.startHold(
      getPresentationVideos(),
      action,
      movieHoldStateRef.current,
    );
  }, []);

  const stopPresentationMovieHold = useCallback(() => {
    movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
  }, []);

  function showSlideNumber() {
    setSlideNumberVisible(true);
    window.setTimeout(() => setSlideNumberVisible(false), 1600);
  }

  function togglePresentationPause(blankScreen?: 'black' | 'white') {
    setPresentationPaused(true);
    setPresentationBlankScreen(blankScreen);
  }

  function resumePresentation() {
    setPresentationPaused(false);
    setPresentationBlankScreen(undefined);
  }

  function executePresentationShortcut(action: KeyboardShortcutAction) {
    if (action === 'shortcut-toggle') {
      setKeyboardShortcutsOpen((current) => !current);
      return;
    }
    if (action === 'quit-presentation') {
      setKeyboardShortcutsOpen(false);
      if (windowedPresentationActive) {
        closeWindowedAudiencePlayback();
        return;
      }
      if (vm.isFullscreen) void vm.toggleFullscreen(workspaceRef.current);
      return;
    }
    if (action === 'open-slide-navigator') {
      setSlideNavigatorIndex(activePageIndex);
      setSlideNavigatorOpen(true);
      return;
    }
    if (action === 'close-slide-navigator') {
      setSlideNavigatorOpen(false);
      return;
    }
    if (action === 'next-navigator-slide') {
      setSlideNavigatorIndex((current) => Math.min(vm.project.pages.length - 1, current + 1));
      return;
    }
    if (action === 'previous-navigator-slide') {
      setSlideNavigatorIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (action === 'select-navigator-slide') {
      playPresentationPageAt(slideNavigatorIndex);
      setSlideNavigatorOpen(false);
      return;
    }
    if (action === 'first-slide') {
      playPresentationPageAt(0);
      return;
    }
    if (action === 'last-slide') {
      playPresentationPageAt(vm.project.pages.length - 1);
      return;
    }
    if (action === 'next-slide') {
      playRelativePresentationSlide(1);
      return;
    }
    if (action === 'previous-slide') {
      playRelativePresentationSlide(-1);
      return;
    }
    if (action === 'next-build') {
      advancePresentationPreviewFromUserAction();
      return;
    }
    if (action === 'previous-build') {
      vm.rewindPresentationPreview();
      return;
    }
    if (action === 'pause-presentation') {
      if (presentationPaused && !presentationBlankScreen) resumePresentation();
      else togglePresentationPause();
      return;
    }
    if (action === 'black-screen' || action === 'white-screen') {
      togglePresentationPause(action === 'black-screen' ? 'black' : 'white');
      return;
    }
    if (action === 'cursor-toggle') {
      setPresentationCursorHidden((current) => !current);
      return;
    }
    if (action === 'show-slide-number') {
      showSlideNumber();
      return;
    }
    if (action === 'play-pause-movie') controlPresentationMovies('play-toggle');
    if (action === 'rewind-movie') pulsePresentationMovieHold('rewind');
    if (action === 'fast-forward-movie') pulsePresentationMovieHold('fast-forward');
    if (action === 'jump-movie-start') controlPresentationMovies('start');
    if (action === 'jump-movie-end') controlPresentationMovies('end');
  }

  function isAnimatedMediaFile(file: File) {
    return file.type === 'image/gif' || file.type.startsWith('video/');
  }

  function openLeftPanel() {
    if (vm.pagesPanelOpen) vm.togglePagesPanel();
    setLeftPanelOpen(true);
  }

  function openAiToolsPanel() {
    vm.setActiveTab('ai-tools');
    openLeftPanel();
  }

  function startAiWorkflowTour() {
    aiWorkflowTourRef.current?.start();
  }

  function closeTourSurfaces() {
    setLeftPanelOpen(false);
    setKeyboardShortcutsOpen(false);
    setSlideNavigatorOpen(false);
    setPresenterRemotePanelOpen(false);
    setAudienceFullscreenPromptOpen(false);
    setSharePanelOpen(false);
    setImageExportPanelOpen(false);
    vm.closeSettings();
    vm.closeMediaSettings();
    vm.closeMirrorSettings();
  }

  function handleLeftPanelOpenChange(open: boolean) {
    if (open) {
      openLeftPanel();
      return;
    }
    setLeftPanelOpen(false);
  }

  function togglePagesPanel() {
    if (!vm.pagesPanelOpen) setLeftPanelOpen(false);
    vm.togglePagesPanel();
  }

  function revealMediaSettingsForElement(elementId: string) {
    const selectedElement = vm.project.elements[elementId];
    if (selectedElement?.type !== 'gif' && selectedElement?.type !== 'video') return;
    vm.setActiveTab('design');
    openLeftPanel();
  }

  function revealElementsForImagePlaceholder(elementId: string) {
    const selectedElement = vm.project.elements[elementId];
    if (
      selectedElement?.type !== 'image' ||
      selectedElement.assetId !== placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID
    ) {
      return false;
    }
    vm.setActiveTab('elements');
    openLeftPanel();
    return true;
  }

  function openDesignFontList() {
    vm.setActiveTab('design');
    openLeftPanel();
    setDesignFontFocusKey((current) => current + 1);
  }

  function selectElement(elementId: string, options?: { additive?: boolean }) {
    vm.selectElement(elementId, options);
    const nextSelection = options?.additive
      ? vm.selection.elementIds.includes(elementId)
        ? vm.selection.elementIds.filter((selectedId) => selectedId !== elementId)
        : [...vm.selection.elementIds, elementId]
      : [elementId];
    if (
      nextSelection.length > 1 &&
      nextSelection.every((selectedId) => vm.project.elements[selectedId]?.type === 'text')
    ) {
      vm.setActiveTab('design');
      openLeftPanel();
    }
    if (options?.additive) return;
    if (revealElementsForImagePlaceholder(elementId)) return;
    revealMediaSettingsForElement(elementId);
  }

  function importMediaFile(file: File) {
    if (isAnimatedMediaFile(file)) {
      vm.setActiveTab('design');
      openLeftPanel();
    }
    void vm.importMediaFile(file);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHistoryReadOnly) return;
      const isEditableTarget = editorShellBrowserUtils.isEditableInteractionTarget(event.target);
      const isUndoShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
      const isRedoShortcut =
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && event.shiftKey) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y');
      if (isUndoShortcut || isRedoShortcut) {
        if (isEditableTarget) return;
        event.preventDefault();
        if (isUndoShortcut) vm.undo();
        if (isRedoShortcut) vm.redo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        if (editorShellBrowserUtils.isEditableInteractionTarget(event.target)) return;
        event.preventDefault();
        vm.selectAllElementsOnActivePage();
        return;
      }

      if (event.key === 'Escape' && (vm.backgroundSelectionMode || vm.backgroundSelectionNotice)) {
        event.preventDefault();
        vm.cancelBackgroundSelectionMode();
        return;
      }

      const isPresenterPlayback = vm.animationPreview?.mode === 'presenter';
      const isPreviewNavigationActive =
        browserPresentationActive || Boolean(isPresenterPlayback && vm.animationPreview?.playing);
      if (keyboardShortcutsOpen && event.key === 'Escape') {
        event.preventDefault();
        setKeyboardShortcutsOpen(false);
        return;
      }
      if (slideNavigatorOpen && !isEditableTarget) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setSlideNavigatorOpen(false);
          return;
        }
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          setSlideNavigatorIndex((current) => Math.min(vm.project.pages.length - 1, current + 1));
          return;
        }
        if (event.key === '-') {
          event.preventDefault();
          setSlideNavigatorIndex((current) => Math.max(0, current - 1));
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          playPresentationPageAt(slideNavigatorIndex);
          setSlideNavigatorOpen(false);
          return;
        }
      }
      if (isPreviewNavigationActive && !isEditableTarget) {
        const lowerKey = event.key.toLowerCase();
        if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
          event.preventDefault();
          setKeyboardShortcutsOpen((current) => !current);
          return;
        }
        if (presentationPaused && !['b', 'f', 'w'].includes(lowerKey)) {
          event.preventDefault();
          resumePresentation();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          if (windowedPresentationActive) {
            closeWindowedAudiencePlayback();
            return;
          }
          if (vm.isFullscreen) void vm.toggleFullscreen(workspaceRef.current);
          return;
        }
        if (event.key === '#') {
          event.preventDefault();
          setSlideNavigatorIndex(activePageIndex);
          setSlideNavigatorOpen(true);
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          playPresentationPageAt(0);
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          playPresentationPageAt(vm.project.pages.length - 1);
          return;
        }
        if (lowerKey === 'f') {
          event.preventDefault();
          if (presentationPaused && !presentationBlankScreen) resumePresentation();
          else togglePresentationPause();
          return;
        }
        if (lowerKey === 'b' || lowerKey === 'w') {
          event.preventDefault();
          togglePresentationPause(lowerKey === 'b' ? 'black' : 'white');
          return;
        }
        if (lowerKey === 'c') {
          event.preventDefault();
          setPresentationCursorHidden((current) => !current);
          return;
        }
        if (lowerKey === 's') {
          event.preventDefault();
          showSlideNumber();
          return;
        }
        if (lowerKey === 'k') {
          event.preventDefault();
          controlPresentationMovies('play-toggle');
          return;
        }
        if (lowerKey === 'j') {
          event.preventDefault();
          if (!event.repeat) startPresentationMovieHold('rewind');
          return;
        }
        if (lowerKey === 'l') {
          event.preventDefault();
          if (!event.repeat) startPresentationMovieHold('fast-forward');
          return;
        }
        if (lowerKey === 'i') {
          event.preventDefault();
          controlPresentationMovies('start');
          return;
        }
        if (lowerKey === 'o') {
          event.preventDefault();
          controlPresentationMovies('end');
          return;
        }
        if (event.key === 'ArrowDown' && event.shiftKey) {
          event.preventDefault();
          playRelativePresentationSlide(1);
          return;
        }
        const isNextPreviewKey =
          event.key === 'ArrowRight' ||
          event.key === 'ArrowDown' ||
          event.key === 'PageDown' ||
          event.key === ']' ||
          event.key === ' ' ||
          event.key === 'Enter';
        const isPreviousPreviewKey =
          event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp';
        if (event.key === '[') {
          event.preventDefault();
          vm.rewindPresentationPreview();
          return;
        }
        if (isNextPreviewKey || isPreviousPreviewKey) {
          event.preventDefault();
          if (isNextPreviewKey) advancePresentationPreviewFromUserAction();
          if (isPreviousPreviewKey) playRelativePresentationSlide(-1);
          return;
        }
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target;
      if (editorShellBrowserUtils.isEditableInteractionTarget(target)) {
        return;
      }

      if (!hasSelection) return;
      event.preventDefault();
      vm.deleteSelectedElement();
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'j' && event.key.toLowerCase() !== 'l') return;
      stopPresentationMovieHold();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    activePageIndex,
    advancePresentationPreviewFromUserAction,
    browserPresentationActive,
    closeWindowedAudiencePlayback,
    controlPresentationMovies,
    hasSelection,
    isHistoryReadOnly,
    keyboardShortcutsOpen,
    playPresentationPageAt,
    playRelativePresentationSlide,
    presentationBlankScreen,
    presentationPaused,
    startPresentationMovieHold,
    slideNavigatorIndex,
    slideNavigatorOpen,
    stopPresentationMovieHold,
    vm,
    windowedPresentationActive,
  ]);

  useEffect(() => {
    return () => {
      movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
      if (windowedExitHintTimerRef.current !== undefined) {
        window.clearTimeout(windowedExitHintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    automationDelegateRef.current = vm.automation;
  }, [vm.automation]);

  authoringVmRef.current = vm;
  authoringVisualRuntimeRef.current = {
    exportRendered: exportRenderedForAutomation,
    async focusSlide(pageId: string) {
      authoringVmRef.current.selectPage(pageId);
      authoringVmRef.current.resetZoom();
      await editorImageExport.waitForNextPaint();
    },
  };

  useEffect(() => {
    prepareProjectFontsForPublicShareRef.current = vm.prepareProjectFontsForPublicShare;
  });

  useEffect(() => {
    const pageId = vm.activePageId;
    if (!pageId) return undefined;
    if (!presenterSessionId && !remotePresenterActive) return undefined;
    if (presenterRemoteUnavailable) return undefined;
    let cancelled = false;
    const service = getPresenterSessionService();
    void service
      .openRemoteControlSession({
        presenterLabel: navigator.platform || 'Presenter device',
        ttlMs: 16 * 60 * 60 * 1000,
      })
      .then((remoteSession) => {
        if (cancelled) return;
        setPresenterRemoteSession(remoteSession);
        service.publishState(createPresenterStatePayload({ activePageId: pageId }));
      })
      .catch(() => {
        if (cancelled) return;
        setPresenterRemoteUnavailable(true);
        setPresenterRemotePanelOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    createPresenterStatePayload,
    presenterRemoteUnavailable,
    presenterSessionId,
    remotePresenterActive,
    vm.activePageId,
  ]);

  useEffect(() => {
    if (!presenterRemoteSession && !presenterSessionId) return undefined;
    return getPresenterSessionService().subscribeToCommands((message) => {
      const savePresenterRecording = (
        recording: TranscriptRecording,
        audioBlob?: Blob,
      ) => {
        const editorOwnedRecording = audioBlob
          ? {
              ...recording,
              audio: {
                ...recording.audio,
                objectUrl: URL.createObjectURL(audioBlob),
              },
            }
          : recording;
        const projectWithRecording = {
          ...vm.project,
          recordings: {
            ...(vm.project.recordings ?? {}),
            [editorOwnedRecording.id]: editorOwnedRecording,
          },
          updatedAt: new Date().toISOString(),
        };
        vm.addTranscriptRecording(editorOwnedRecording);
        getPresenterSessionService().publishState(
          createPresenterStatePayload({
            activePageId: vm.activePageId,
            animationPreview: vm.animationPreview,
            presenterMode: presenterSessionId || remotePresenterActive ? 'presenting' : 'ready',
            project: projectWithRecording,
          }),
        );
      };

      if (message.command === 'start-presenting') {
        const firstPageId =
          pageVisibility.getFirstVisiblePage(vm.project)?.id ??
          vm.project.pages[0]?.id ??
          vm.activePageId;
        setRemotePresenterActive(true);
        if (firstPageId) {
          vm.playPresentationPreview(firstPageId);
          void vm.toggleFullscreen(workspaceRef.current);
        }
        getPresenterSessionService().publishState(
          createPresenterStatePayload({ activePageId: firstPageId, presenterMode: 'presenting' }),
        );
        return;
      }
      if (message.command === 'prepare-prompt-api') {
        void vm.preparePromptApi();
        return;
      }
      if (message.command === 'set-prompt-provider') {
        void vm.setPromptProvider(message.providerId);
        return;
      }
      if (message.command === 'cancel-prompt-model-download') {
        void vm.cancelPromptModelDownload(message.modelId);
        return;
      }
      if (message.command === 'next') {
        if (!presenterSessionId && !remotePresenterActive) return;
        advancePresentationPreviewFromUserAction();
        return;
      }
      if (message.command === 'previous') {
        if (!presenterSessionId && !remotePresenterActive) return;
        vm.rewindPresentationPreview();
        return;
      }
      if (message.command === 'go-to-page') {
        if (!presenterSessionId && !remotePresenterActive) return;
        vm.playPresentationPreview(message.pageId);
        return;
      }
      if (message.command === 'update-notes') {
        vm.updatePageSpeakerNotes(message.pageId, message.notes);
        return;
      }
      if (message.command === 'save-recording') {
        pendingPresenterRecordingsRef.current.delete(message.recording.id);
        savePresenterRecording(message.recording, message.audioBlob);
        return;
      }
      if (message.command === 'recording-checkpoint') {
        const pendingRecording = pendingPresenterRecordingsRef.current.get(message.recording.id);
        pendingPresenterRecordingsRef.current.set(message.recording.id, {
          chunks: [
            ...(pendingRecording?.chunks ?? []),
            ...(message.audioChunk ? [message.audioChunk] : []),
          ],
          recording: message.recording,
        });
        return;
      }
      if (message.command === 'update-stream-peer') {
        setPresenterRemoteStreamPeerId(message.peerId);
        return;
      }
      if (message.command === 'request-state') {
        getPresenterSessionService().publishState(createPresenterStatePayload());
        return;
      }
      if (message.command === 'close') {
        closePresenterViewSession();
      }
    });
  }, [
    advancePresentationPreviewFromUserAction,
    createPresenterStatePayload,
    presenterRemoteSession,
    presenterSessionId,
    remotePresenterActive,
    closePresenterViewSession,
    vm,
  ]);

  useEffect(() => {
    if (!presenterSessionId) {
      presenterFullscreenEnteredRef.current = false;
      return;
    }
    if (vm.isFullscreen) {
      presenterFullscreenEnteredRef.current = true;
      return;
    }
    if (presenterFullscreenEnteredRef.current) {
      presenterFullscreenEnteredRef.current = false;
      if (presenterRemoteSession) return;
      queueMicrotask(closePresenterViewSession);
    }
  }, [closePresenterViewSession, presenterRemoteSession, presenterSessionId, vm.isFullscreen]);

  useEffect(() => {
    if (!presenterRemoteSession) return;
    getPresenterSessionService().publishState(createPresenterStatePayload());
  }, [createPresenterStatePayload, presenterRemoteSession]);

  useEffect(() => {
    if (!presenterRemotePanelOpen) return;

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (presenterRemotePanelRef.current?.contains(target)) return;

      setPresenterRemotePanelOpen(false);
    }

    document.addEventListener('pointerdown', handleOutsidePointer);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [presenterRemotePanelOpen]);

  useEffect(() => {
    function handleCopy(event: ClipboardEvent) {
      if (isHistoryReadOnly) return;
      if (
        editorShellBrowserUtils.isEditableInteractionTarget(event.target) ||
        editorShellBrowserUtils.hasBrowserTextSelection() ||
        !hasSelection
      )
        return;
      event.preventDefault();
      const clipboard = vm.copySelectedElements();
      if (!clipboard) return;
      editorShellBrowserUtils.writeEditorObjectClipboardPayload(
        event.clipboardData,
        JSON.stringify(clipboard),
      );
    }

    function handleCut(event: ClipboardEvent) {
      if (isHistoryReadOnly) return;
      if (
        editorShellBrowserUtils.isEditableInteractionTarget(event.target) ||
        editorShellBrowserUtils.hasBrowserTextSelection() ||
        !hasSelection
      )
        return;
      event.preventDefault();
      const clipboard = vm.copySelectedElements();
      if (!clipboard) return;
      vm.cutSelectedElements();
      editorShellBrowserUtils.writeEditorObjectClipboardPayload(
        event.clipboardData,
        JSON.stringify(clipboard),
      );
    }

    function handlePaste(event: ClipboardEvent) {
      if (isHistoryReadOnly) return;
      if (editorShellBrowserUtils.isEditableInteractionTarget(event.target)) return;
      event.preventDefault();
      const slidePayload = editorShellBrowserUtils.readSlideClipboardPayload(event.clipboardData);
      if (slidePayload) {
        try {
          if (vm.pasteSlideClipboardPayload(JSON.parse(slidePayload) as unknown)) return;
        } catch {
          // Continue to the object and image clipboard paths.
        }
      }
      const payload = editorShellBrowserUtils.readEditorObjectClipboardPayload(event.clipboardData);
      if (payload) {
        try {
          if (vm.pasteClipboardElements(JSON.parse(payload) as unknown)) return;
        } catch {
          // Fall through to the existing in-tab clipboard and image paths.
        }
      }
      if (
        editorShellBrowserUtils.hasEditorObjectClipboardMarker(event.clipboardData) &&
        vm.pasteCopiedElements()
      )
        return;
      const imageFile = editorShellBrowserUtils.getClipboardImageFile(event.clipboardData);
      if (imageFile) {
        void vm.importImageFile(imageFile);
        return;
      }
      vm.pasteCopiedElements();
    }

    window.addEventListener('copy', handleCopy);
    window.addEventListener('cut', handleCut);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('cut', handleCut);
      window.removeEventListener('paste', handlePaste);
    };
  }, [hasSelection, isHistoryReadOnly, vm]);

  async function copyPageToClipboard(pageId: string) {
    const payload = vm.getSlideClipboardPayload(pageId);
    if (!payload) return;
    const transferablePayload = editorShellBrowserUtils
      .makeSlideClipboardPayloadTransferable(payload)
      .then((nextPayload) => JSON.stringify(nextPayload));
    await editorShellBrowserUtils.writeSlideClipboardPayload(transferablePayload);
  }

  useEffect(() => {
    if (!editorShellBrowserUtils.isWebMcpProtocolEnabled()) return undefined;
    const getProject = () => automationDelegateRef.current.getState().project;
    const applyProject = (project: ProjectDocument, activePageId?: string) =>
      authoringVmRef.current.applyProjectForAutomation(project, activePageId);
    const assetCapabilities = createAuthoringAssetCapabilities({
      applyProject,
      fontImportService: services.fontImportService,
      getProject,
      imageGenerationService: services.imageGenerationService,
      localFontMirrorService: services.localFontMirrorService,
      modelSetupService: services.modelSetupService,
      promptService: services.promptService,
      stockMediaService: services.stockMediaService,
      translatorService: services.translatorService,
    });
    const deckLocalization = deckLocalizationCapability.create({
      applyProject,
      descriptionGenerator: localSlideDescriptionGenerator.create(),
      getProject,
      getProjectRevision: authoringRevision.getPresentation,
      getSlideRevision: authoringRevision.getSlide,
      translatorService: services.translatorService,
    });
    const powerPointUrlImportService = new PowerPointUrlImportService({
      applyProject: (project) => authoringVmRef.current.replaceProjectForAutomation(project),
      fontImportService: services.fontImportService,
      normalizeProject: editorViewModelProject.normalizeProjectDocument,
      presentationImportService: services.presentationImportService,
    });
    const visualCapability = createAuthoringVisualCapability({
      downloadBlob: services.exportService.downloadBlob.bind(services.exportService),
      exportPowerPoint: (project, report) =>
        services.presentationExportService.exportPowerPoint(project, {
          onProgress: (progress) =>
            report({
              stage: progress.stage,
              detail: progress.detail ?? progress.label,
              progress:
                progress.current !== undefined && progress.total
                  ? Math.max(5, Math.min(90, Math.round((progress.current / progress.total) * 90)))
                  : 20,
              ...(progress.current !== undefined ? { current: progress.current } : {}),
              ...(progress.total !== undefined ? { total: progress.total } : {}),
            }),
        }),
      exportRendered: (project, input, report) => {
        const runtime = authoringVisualRuntimeRef.current;
        if (!runtime) throw new Error('The editor rendering surface is not ready.');
        return runtime.exportRendered(project, input, report);
      },
      focusSlide: (pageId) => {
        const runtime = authoringVisualRuntimeRef.current;
        if (!runtime) throw new Error('The editor rendering surface is not ready.');
        return runtime.focusSlide(pageId);
      },
      getActivePageId: () => authoringVmRef.current.activePageId,
      getProject: () => automationDelegateRef.current.getState().project,
    });
    const delegate = createAuthoringAutomationDelegate({
      assetCapabilities,
      deckLocalization,
      fontImportService: services.fontImportService,
      getProject,
      replaceProject: (project) => authoringVmRef.current.replaceProjectForAutomation(project),
      applyProject,
      powerPointUrlImportService,
      visualCapability,
    });
    const adapter = new WebMcpToolAdapter(
      new authoringAutomationController.AuthoringAutomationController(delegate, {
        onOperationStatusChange: setWebMcpOperationStatus,
      }),
    );
    const demoWindow = window as WebMcpDemoWindow;
    const modelContext = editorShellBrowserUtils.getWebMcpModelContext();
    demoWindow.localStudioWebMcpTools = adapter.createTools();
    const unregister = modelContext ? adapter.register(modelContext) : undefined;

    return () => {
      unregister?.();
      delete demoWindow.localStudioWebMcpTools;
      setWebMcpOperationStatus(undefined);
    };
  }, [services]);

  useEffect(() => {
    if (!webMcpOperationStatus || ['queued', 'running'].includes(webMcpOperationStatus.state)) {
      return undefined;
    }
    const terminalStatus = webMcpOperationStatus;
    const timeoutId = window.setTimeout(() => {
      setWebMcpOperationStatus((current) =>
        current?.operationId === terminalStatus.operationId &&
        current.revision === terminalStatus.revision
          ? undefined
          : current,
      );
    }, 6_000);
    return () => window.clearTimeout(timeoutId);
  }, [webMcpOperationStatus]);

  useEffect(
    () => () => {
      if (imageExportNoticeTimeoutRef.current === undefined) return;
      window.clearTimeout(imageExportNoticeTimeoutRef.current);
      imageExportNoticeTimeoutRef.current = undefined;
    },
    [],
  );

  useEffect(() => {
    if (!shareMetadata?.shareId) return undefined;
    if (!mirrorHasCurrentProject) {
      const nextStatus = vm.mirrorState.status === 'failed' ? 'sync-failed' : 'syncing';
      if (shareMetadata.status === nextStatus) return undefined;
      const timeoutId = window.setTimeout(() => {
        setShareMetadata((current) => (current ? { ...current, status: nextStatus } : current));
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
    if (
      hasPublishedCurrentProjectShare(shareMetadata, latestShareRecordingId, vm.project)
    ) {
      return undefined;
    }
    void publishCurrentProjectShare(latestShareRecordingId).catch(() => undefined);
    return undefined;
  }, [
    hasPublishedCurrentProjectShare,
    latestShareRecordingId,
    mirrorHasCurrentProject,
    publishCurrentProjectShare,
    shareMetadata,
    vm.mirrorState.status,
    vm.project,
  ]);

  return (
    <div className="app-shell">
      <EditorAiWorkflowTour
        ref={aiWorkflowTourRef}
        onCloseTourSurfaces={closeTourSurfaces}
        onOpenAiTools={openAiToolsPanel}
        onOpenMirrorSettings={vm.openMirrorSettings}
        onOpenSettings={vm.openSettings}
      />
      <EditorToolbarSurface
        deckTranslationStatus={deckTranslationStatus}
        hasDirectoryPersistence={hasDirectoryPersistence}
        hasSelection={hasSelection}
        imageExportNotice={imageExportNotice}
        isExportingImages={isExportingImages}
        isExportingPdf={isExportingPdf}
        isHistoryReadOnly={isHistoryReadOnly}
        services={services}
        vm={vm}
        onExportImages={() => {
          setImageExportPanelOpen(true);
        }}
        onExportPdf={() => {
          void exportPdf();
        }}
        onNewProject={openBlankProjectInNewTab}
        onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)}
        onStartAiSetupTour={startAiWorkflowTour}
        onLocalProjectSetupCancel={() => {
          pendingShareAfterLocalSaveRef.current = false;
        }}
        onLocalProjectSetupConfirm={continueShareAfterLocalSave}
        onShare={() => {
          void openShareWorkflow();
        }}
        onOpenPresenterView={openPresenterView}
        onStartPresenterMode={startPresenterMode}
      />
      <div
        className={vm.pagesPanelOpen ? 'editor-grid' : 'editor-grid editor-grid-pages-collapsed'}
      >
        <EditorLeftPanelSurface
          designFontFocusKey={designFontFocusKey}
          isHistoryReadOnly={isHistoryReadOnly}
          leftPanelOpen={leftPanelOpen}
          vm={vm}
          onImportMedia={importMediaFile}
          onOpenChange={handleLeftPanelOpenChange}
          onSelectElement={selectElement}
        />
        <section
          className={[
            'workspace-column',
            leftPanelOpen ? 'workspace-column-left-panel-open' : '',
            vm.zoomPercent < 100 ? 'workspace-column-zoomed-out' : '',
            windowedPresentationActive ? 'workspace-column-windowed-presentation' : '',
            presentationCursorHidden ? 'workspace-column-cursor-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Canvas workspace"
          data-tour-id="canvas-workspace"
          ref={workspaceRef}
          onMouseMove={handleWorkspacePointerMove}
        >
          {webMcpOperationStatus ? <WebMcpOperationNotice status={webMcpOperationStatus} /> : null}
          {windowedPresentationActive && windowedExitHintVisible ? (
            <div className="windowed-presentation-exit-tooltip" role="tooltip">
              Press Esc to exit full screen
            </div>
          ) : null}
          {keyboardShortcutsOpen ? (
            <KeyboardShortcutsDialog
              onClose={() => setKeyboardShortcutsOpen(false)}
              onShortcutAction={executePresentationShortcut}
              supportedActions={editorShortcutActions}
            />
          ) : null}
          {slideNavigatorOpen ? (
            <PresentationSlideNavigator
              project={vm.project}
              selectedIndex={slideNavigatorIndex}
              onClose={() => setSlideNavigatorOpen(false)}
              onPlayPageAt={(index) => {
                playPresentationPageAt(index);
                setSlideNavigatorOpen(false);
              }}
              onSelectIndex={setSlideNavigatorIndex}
            />
          ) : null}
          {presentationBlankScreen ? (
            <div
              className={
                presentationBlankScreen === 'black'
                  ? 'presentation-blank-screen presentation-blank-screen-black'
                  : 'presentation-blank-screen presentation-blank-screen-white'
              }
              aria-label={presentationBlankScreen === 'black' ? 'Black screen' : 'White screen'}
            />
          ) : null}
          {slideNumberVisible ? (
            <div className="presentation-slide-number" aria-live="polite">
              Slide {activeVisiblePageIndex + 1} of {visiblePageCount}
            </div>
          ) : null}
          <ScrollingCanvasWorkspace
            project={vm.project}
            activePageId={vm.activePageId}
            activePageFocusKey={vm.activePageFocusKey}
            selection={vm.selection}
            slideFrameRef={slideFrameRef}
            stageRef={stageRef}
            presentationMode={browserPresentationActive || vm.animationPreview?.mode === 'presenter'}
            readOnly={isHistoryReadOnly}
            zoomPercent={vm.zoomPercent}
            backgroundSelectionMode={vm.backgroundSelectionMode}
            backgroundSelectionNotice={vm.backgroundSelectionNotice}
            processingElementIds={vm.processingElementIds}
            backgroundPreview={vm.backgroundPreview}
            animationPreview={vm.animationPreview}
            backgroundPreparation={vm.backgroundPreparation}
            canTranslateCurrentSlide={vm.canTranslateCurrentSlide}
            translatingPageIds={vm.deckTranslationProgress?.activePageIds}
            canTranslateSelection={vm.canTranslateSelection}
            isTranslating={vm.isTranslating}
            translationNotice={vm.translationNotice}
            onAlignSelectedElement={isHistoryReadOnly ? undefined : vm.alignSelectedElement}
            onEditSelectionGrid={
              isHistoryReadOnly
                ? undefined
                : () => {
                    vm.setActiveTab('layout');
                    openLeftPanel();
                  }
            }
            onAnimationPreviewAdvance={
              browserPresentationActive || vm.animationPreview?.mode === 'presenter'
                ? vm.advancePresentationPreview
                : vm.advanceAnimationPreview
            }
            onBackgroundSelectionToggle={
              isHistoryReadOnly ? undefined : vm.toggleBackgroundSelectionMode
            }
            onBackgroundSubjectPick={
              isHistoryReadOnly
                ? undefined
                : (elementId, point) => {
                    void vm.pickBackgroundSubject(elementId, point);
                  }
            }
            onBackgroundPreviewPoint={isHistoryReadOnly ? undefined : vm.previewBackgroundSubject}
            onBackgroundRefinePoint={isHistoryReadOnly ? undefined : vm.refineBackgroundSubject}
            onBringSelectedElementForward={
              isHistoryReadOnly
                ? undefined
                : () => {
                    vm.setSelectedElementZOrder('forward');
                  }
            }
            onCancelBackgroundSelection={
              isHistoryReadOnly ? undefined : vm.cancelBackgroundSelectionMode
            }
            onCanvasBackgroundDoubleClick={
              isHistoryReadOnly
                ? undefined
                : () => {
                    vm.setActiveTab('layout');
                    openLeftPanel();
                  }
            }
            onClearSelection={isHistoryReadOnly ? undefined : vm.clearSelection}
            onDeleteSelectedElement={isHistoryReadOnly ? undefined : vm.deleteSelectedElement}
            onDuplicateSelectedElement={isHistoryReadOnly ? undefined : vm.duplicateSelectedElement}
            onFlipSelectedImage={isHistoryReadOnly ? undefined : vm.flipSelectedImage}
            onInsertMedia={
              isHistoryReadOnly
                ? undefined
                : () => {
                    toolbarImageInputRef.current?.click();
                  }
            }
            onInsertText={
              isHistoryReadOnly
                ? undefined
                : () => {
                    vm.insertTextElement();
                  }
            }
            onOpenAnimations={
              isHistoryReadOnly
                ? undefined
                : () => {
                    vm.setActiveTab('animations');
                    openLeftPanel();
                  }
            }
            onOpenFontPanel={isHistoryReadOnly ? undefined : openDesignFontList}
            onSelectPresentation={isHistoryReadOnly ? undefined : vm.selectPresentation}
            onSelectSlide={isHistoryReadOnly ? undefined : vm.selectSlideBackground}
            onSelectElement={isHistoryReadOnly ? undefined : selectElement}
            onSendSelectedElementBackward={
              isHistoryReadOnly
                ? undefined
                : () => {
                    vm.setSelectedElementZOrder('backward');
                  }
            }
            onTranslatePage={
              isHistoryReadOnly
                ? undefined
                : (pageId) => {
                    void vm.translatePage(pageId);
                  }
            }
            onTranslateSelectedText={
              isHistoryReadOnly
                ? undefined
                : () => {
                    void vm.translateSelectedText();
                  }
            }
            onUpdateImageCrop={isHistoryReadOnly ? undefined : vm.updateImageCrop}
            onUpdateElementFrame={isHistoryReadOnly ? undefined : vm.updateElementFrame}
            onUpdateElementFrames={isHistoryReadOnly ? undefined : vm.updateElementFrames}
            onUpdateElementStyle={isHistoryReadOnly ? undefined : vm.updateElementStyle}
            onUpdateElementStyles={isHistoryReadOnly ? undefined : vm.updateElementStyles}
            onApplyFormat={isHistoryReadOnly ? undefined : vm.applyFormatToSelection}
            onUpdateTextContent={isHistoryReadOnly ? undefined : vm.updateTextContent}
            onActivePageFromScroll={vm.activateScrolledPage}
            onAddPage={isHistoryReadOnly ? undefined : vm.addPage}
            onDeletePage={isHistoryReadOnly ? undefined : vm.deletePage}
            onDuplicatePage={isHistoryReadOnly ? undefined : vm.duplicatePage}
            onCopyPage={isHistoryReadOnly ? undefined : (pageId) => void copyPageToClipboard(pageId)}
            onRenamePage={isHistoryReadOnly ? undefined : vm.renamePage}
            onReorderPage={isHistoryReadOnly ? undefined : vm.reorderPage}
            onSetPageVisibility={isHistoryReadOnly ? undefined : vm.setPageVisibility}
          />
          {activePage ? (
            <SpeakerNotesEditor
              page={activePage}
              pageIndex={activePageIndex}
              open={speakerNotesOpen}
              onClose={() => setSpeakerNotesOpen(false)}
              onUpdateNotes={vm.updatePageSpeakerNotes}
            />
          ) : null}
          {presenterViewError ? (
            <p className="presenter-view-error" role="alert">
              {presenterViewError}
            </p>
          ) : null}
          {presenterRemoteSession && presenterRemotePanelOpen ? (
            <div ref={presenterRemotePanelRef}>
              <PresenterRemotePanel session={presenterRemoteSession} />
            </div>
          ) : null}
          {audienceFullscreenPromptOpen ? (
            <AudienceFullscreenPrompt
              mode={audiencePromptMode}
              onClose={closePresenterViewSession}
              onEnterFullscreen={enterAudienceFullscreen}
              onStartWindowed={startWindowedAudiencePlayback}
            />
          ) : null}
          <input
            ref={toolbarImageInputRef}
            aria-label="Insert media file"
            className="visually-hidden-input"
            type="file"
            accept={localMediaImportConfig.accept}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file || isHistoryReadOnly) return;
              importMediaFile(file);
              event.target.value = '';
            }}
          />
          {!isHistoryReadOnly ? (
            <PromptBar
              createImageNotice={vm.createImageNotice}
              createImageStatus={vm.createImageStatus}
              createImageOptions={vm.createImageOptions}
              createImageModelControlState={imageGenerationModelControlState}
              slideModelControlState={promptModelControlState}
              generationNotice={vm.promptGenerationNotice}
              generationStatus={vm.promptGenerationStatus}
              isGeneratingImage={vm.isGeneratingImage}
              isGeneratingSlide={vm.isGeneratingSlide}
              selectedImageElementId={vm.selectedImagePromptElementId}
              onCreateImagePromptIntent={() => vm.ensureImageGenerationReadyForPrompt()}
              onCreateImageSubmit={async (prompt, options) => {
                services.analyticsService.capture(postHogEvents.aiImageGenerated, {
                  project_name: vm.project.name,
                  page_count: vm.project.pages.length,
                  prompt_length: prompt.length,
                  image_width: options.width,
                  image_height: options.height,
                  image_steps: options.steps,
                  ...analyticsModelProperties.getImageGenerationModelProperties(),
                });
                return vm.generateImageFromPrompt(prompt, options);
              }}
              onCancelCreateImageModelDownload={vm.cancelModelDownload}
              onCancelPromptModelDownload={vm.cancelPromptModelDownload}
              onPrepareCreateImageModel={() =>
                vm.downloadModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID)
              }
              onPreparePromptApi={vm.preparePromptApi}
              onPromptProviderChange={(providerId) => {
                void vm.setPromptProvider(providerId);
              }}
              onSlidePromptSubmit={async (prompt) => {
                services.analyticsService.capture(postHogEvents.aiSlideGenerated, {
                  project_name: vm.project.name,
                  page_count: vm.project.pages.length,
                  prompt_length: prompt.length,
                  ...analyticsModelProperties.getSelectedPromptModelProperties(
                    vm.promptProviderStates,
                  ),
                });
                return vm.generateSlideFromPrompt(prompt);
              }}
              onStopGeneration={vm.stopPromptGeneration}
            />
          ) : null}
        </section>
        {vm.pagesPanelOpen ? (
          <PagesPanel
            project={vm.project}
            activePageId={vm.activePageId}
            canTranslate={vm.canTranslateDeck}
            onAddPage={isHistoryReadOnly ? undefined : vm.addPage}
            onClose={togglePagesPanel}
            onDeletePage={isHistoryReadOnly ? undefined : vm.deletePage}
            onDuplicatePage={isHistoryReadOnly ? undefined : vm.duplicatePage}
            onCopyPage={isHistoryReadOnly ? undefined : (pageId) => void copyPageToClipboard(pageId)}
            onRenamePage={isHistoryReadOnly ? undefined : vm.renamePage}
            onReorderPage={isHistoryReadOnly ? undefined : vm.reorderPage}
            onSelectPage={vm.selectPage}
            onSetPageVisibility={isHistoryReadOnly ? undefined : vm.setPageVisibility}
            onTranslatePage={
              isHistoryReadOnly
                ? undefined
                : (pageId) => {
                    void vm.translatePage(pageId);
                  }
            }
          />
        ) : null}
      </div>
      {vm.versionHistoryOpen ? (
        <VersionHistoryPanel
          entries={vm.versionHistoryEntries}
          highlightChanges={vm.highlightVersionChanges}
          selectedVersionId={vm.selectedVersionId}
          onClose={vm.closeVersionHistory}
          onHighlightChangesChange={vm.setHighlightVersionChanges}
          onRestoreVersion={(versionId) => {
            void vm.restoreVersion(versionId);
          }}
          onSelectVersion={(versionId) => {
            void vm.selectVersion(versionId);
          }}
        />
      ) : null}
      {sharePanelOpen ? (
        <SharePanel
          projectName={vm.project.name}
          recordingOptions={shareRecordingOptions}
          share={shareMetadata}
          shareProgress={sharePublishProgress}
          onClose={() => {
            setSharePanelOpen(false);
          }}
          onConfigurePublicLink={() => {
            setSharePanelOpen(false);
            vm.openMirrorSettings();
          }}
          onCopyLink={copyPublicShareLink}
          publicLinkUnavailableReason={
            publicSharingAvailable ? undefined : publicSharingUnavailableReason
          }
          onDownload={exportCurrentPageAsPng}
          onPresent={presentFromSharePanel}
        />
      ) : null}
      {imageExportPanelOpen ? (
        <ImageExportPanel
          isExporting={isExportingImages}
          pageCount={vm.project.pages.length}
          onClose={() => {
            setImageExportPanelOpen(false);
          }}
          onExport={(options) => {
            void exportImages(options);
          }}
        />
      ) : null}
      {vm.settingsOpen ? (
        <SettingsPanel
          onClose={vm.closeSettings}
          onOpenMediaSettings={vm.openMediaSettings}
          onOpenMirrorSettings={vm.openMirrorSettings}
        />
      ) : null}
      {vm.mediaSettingsOpen ? (
        <MediaIntegrationSettingsPanel
          config={vm.stockMediaConfig}
          onClear={vm.clearStockMediaConfig}
          onBack={() => {
            vm.closeMediaSettings();
            vm.openSettings();
          }}
          onClose={vm.closeMediaSettings}
          onSave={vm.saveStockMediaConfig}
        />
      ) : null}
      {vm.mirrorSettingsOpen ? (
        <MirrorSettingsPanel
          config={vm.mirrorConfig}
          localFontMirrorSettings={vm.localFontMirrorSettings}
          localFontOptions={vm.localFontOptions}
          mirrorState={vm.mirrorState}
          mirrorDisabledBySettings={vm.mirrorDisabledBySettings}
          onBack={() => {
            vm.closeMirrorSettings();
            vm.openSettings();
          }}
          onChooseLocalFontFolder={vm.chooseLocalFontMirrorFolder}
          onClose={vm.closeMirrorSettings}
          onEnabledChange={vm.setMirrorEnabledFromSettings}
          onLocalFontMirrorEnabledChange={vm.setLocalFontMirrorEnabled}
          onSave={vm.saveMirrorConfig}
          onTestConnection={vm.testMirrorConnection}
        />
      ) : null}
      {vm.remoteImportOpen ? (
        <RemoteImportPanel
          error={vm.remoteImportError}
          progress={vm.remoteImportProgress}
          projects={vm.remoteImportProjects}
          status={vm.remoteImportStatus}
          onClose={vm.closeRemoteImport}
          onDeleteProject={(projectId) => {
            void vm.deleteRemoteMirrorProject(projectId);
          }}
          onImportProject={(projectId) => {
            void vm.importRemoteMirrorProject(projectId);
          }}
        />
      ) : null}
      {vm.missingPowerPointFonts.length > 0 && !fontReplacementOpen ? (
        <PowerPointFontWarningDialog
          missingFonts={vm.missingPowerPointFonts}
          onDismiss={vm.dismissMissingPowerPointFonts}
          onReplaceFonts={() => setFontReplacementOpen(true)}
        />
      ) : null}
      {vm.missingPowerPointFonts.length > 0 && fontReplacementOpen ? (
        <PowerPointFontReplacementDialog
          downloadableFonts={vm.downloadableFonts}
          missingFonts={vm.missingPowerPointFonts}
          onClose={() => setFontReplacementOpen(false)}
          onReplaceFont={vm.replacePowerPointFont}
        />
      ) : null}
      {vm.presentationImportProgress ? (
        <PresentationImportProgressOverlay progress={vm.presentationImportProgress} />
      ) : null}
      {vm.mediaImportProgress ? (
        <MediaImportProgressOverlay
          progress={vm.mediaImportProgress}
          onDismiss={vm.clearMediaImportProgress}
        />
      ) : null}
      <ProjectVideoPreloader project={vm.project} />
      <EditorFooter
        activePageIndex={activeVisiblePageIndex}
        notesOpen={speakerNotesOpen}
        pageCount={visiblePageCount}
        pagesPanelOpen={vm.pagesPanelOpen}
        zoomPercent={vm.zoomPercent}
        onResetZoom={vm.resetZoom}
        onOpenSettings={vm.openSettings}
        onToggleNotes={() => setSpeakerNotesOpen((current) => !current)}
        onTogglePagesPanel={togglePagesPanel}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
      {imageExportRender ? (
        <div className="image-export-renderer" aria-hidden="true">
          <CanvasWorkspace
            project={imageExportRender.project}
            activePageId={imageExportRender.frame.pageId}
            animationPreview={imageExportRender.frame.animationPreview}
            canvasLabel="Image export canvas"
            readOnly
            selection={{ elementIds: [], pageId: imageExportRender.frame.pageId }}
            stageRef={imageExportStageRef}
            zoomPercent={100}
          />
        </div>
      ) : null}
    </div>
  );
}
