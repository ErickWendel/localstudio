import { useCallback, useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { AppServices } from '../../../app/composition';
import type { ShareMetadata } from '../../../services/contracts/interfaces';
import { editorAutomationController } from '../../../services/automation/editorAutomationController';
import type { EditorAutomationDelegate } from '../../../services/automation/editorAutomationController';
import { modelSetupService } from '../../../services/model-setup/modelSetupService';
import {
  WebMcpToolAdapter,
  type WebMcpDemoWindow,
} from '../../../services/webmcp/webMcpToolAdapter';
import { EditorFooter } from './EditorFooter';
import { MediaImportProgressOverlay } from './MediaImportProgressOverlay';
import { PresentationImportProgressOverlay } from './PresentationImportProgressOverlay';
import { LeftToolPanel } from '../panels/LeftToolPanel';
import { LocalProjectSetupPanel } from '../panels/LocalProjectSetupPanel';
import { MediaIntegrationSettingsPanel } from '../panels/MediaIntegrationSettingsPanel';
import { MirrorSettingsPanel } from '../panels/MirrorSettingsPanel';
import { PagesPanel } from '../panels/PagesPanel';
import { ProjectVideoPreloader } from '../media/ProjectVideoPreloader';
import { localMediaImportConfig } from '../media/localMediaImportConfig';
import { movieStartPlayback } from '../media/movieStartPlayback';
import { PromptBar } from '../prompting/PromptBar';
import { RemoteImportPanel } from '../panels/RemoteImportPanel';
import { ScrollingCanvasWorkspace } from '../canvas/ScrollingCanvasWorkspace';
import { SettingsPanel } from '../panels/SettingsPanel';
import { TopToolbar } from '../toolbars/TopToolbar';
import { VersionHistoryPanel } from '../panels/VersionHistoryPanel';
import {
  presentationMovieControls,
  type MovieHoldState,
} from '../media/presentationMovieControls';
import { useEditorViewModel } from '../state/useEditorViewModel';
import { SharePanel } from '../../share/SharePanel';
import {
  KeyboardShortcutsDialog,
  type KeyboardShortcutAction,
} from '../../components/KeyboardShortcutsDialog';
import { editorShellBrowserUtils } from '../browser/editorShellBrowserUtils';
import { BrowserPresenterSessionService } from '../../../services/presenter/presenterSessionService';
import type { PresenterRemoteSessionMetadata } from '../../../services/presenter/presenterSessionTypes';
import { PresenterRemotePanel } from '../../presenter/PresenterRemotePanel';

interface EditorShellProps {
  services: AppServices;
}

const editorShortcutActions = [
  'next-build',
  'previous-build',
  'next-slide',
  'previous-slide',
  'first-slide',
  'last-slide',
  'quit-presentation',
  'shortcut-toggle',
  'pause-presentation',
  'black-screen',
  'white-screen',
  'cursor-toggle',
  'show-slide-number',
  'open-slide-navigator',
  'next-navigator-slide',
  'previous-navigator-slide',
  'select-navigator-slide',
  'close-slide-navigator',
  'play-pause-movie',
  'rewind-movie',
  'fast-forward-movie',
  'jump-movie-start',
  'jump-movie-end',
] satisfies KeyboardShortcutAction[];

export function EditorShell({ services }: EditorShellProps) {
  const vm = useEditorViewModel(services);
  const automationDelegateRef = useRef(vm.automation);
  const movieHoldStateRef = useRef<MovieHoldState | undefined>(undefined);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [designFontFocusKey, setDesignFontFocusKey] = useState(0);
  const [speakerNotesOpen, setSpeakerNotesOpen] = useState(false);
  const [audienceFullscreenPromptOpen, setAudienceFullscreenPromptOpen] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [slideNavigatorOpen, setSlideNavigatorOpen] = useState(false);
  const [slideNavigatorIndex, setSlideNavigatorIndex] = useState(0);
  const [presentationPaused, setPresentationPaused] = useState(false);
  const [presentationBlankScreen, setPresentationBlankScreen] = useState<'black' | 'white' | undefined>();
  const [presentationCursorHidden, setPresentationCursorHidden] = useState(false);
  const [slideNumberVisible, setSlideNumberVisible] = useState(false);
  const [presenterSessionId, setPresenterSessionId] = useState<string | undefined>();
  const [presenterRemoteSession, setPresenterRemoteSession] = useState<PresenterRemoteSessionMetadata | undefined>();
  const [presenterRemotePanelOpen, setPresenterRemotePanelOpen] = useState(false);
  const [remotePresenterActive, setRemotePresenterActive] = useState(false);
  const [presenterViewError, setPresenterViewError] = useState<string | undefined>();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareMetadata, setShareMetadata] = useState<ShareMetadata | undefined>();
  const stageRef = useRef<Konva.Stage>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const slideFrameRef = useRef<HTMLDivElement>(null);
  const presenterSessionServiceRef = useRef<BrowserPresenterSessionService | undefined>(undefined);
  const presenterRemotePanelRef = useRef<HTMLDivElement>(null);
  const presenterFullscreenEnteredRef = useRef(false);
  const toolbarImageInputRef = useRef<HTMLInputElement>(null);
  const hasSelection = vm.selection.elementIds.length > 0;
  const isHistoryReadOnly = vm.versionHistoryOpen;
  const activePageIndex = Math.max(
    0,
    vm.project.pages.findIndex((page) => page.id === vm.activePageId),
  );
  const activePage = vm.project.pages[activePageIndex];
  const deckTranslationStatus = vm.deckTranslationProgress
    ? `Translating ${vm.deckTranslationProgress.currentPageName} · ${vm.deckTranslationProgress.completedPages}/${vm.deckTranslationProgress.totalPages}`
    : undefined;
  const publicSharingAvailable = vm.mirrorState.enabled && vm.mirrorState.status === 'synced';
  const publicSharingUnavailableReason = 'Public links cannot be created without remote storage.';
  const hasDirectoryPersistence = services.persistenceMode === 'directory';

  function exportCurrentPageAsPng() {
    const dataUrl = stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
    if (!dataUrl) return;
    services.exportService.downloadDataUrl(
      dataUrl,
      services.exportService.getPageImageFileName(vm.project, vm.activePageId, 'png'),
    );
  }

  function openBlankProjectInNewTab() {
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    url.searchParams.set('newProject', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  async function copyPublicShareLink() {
    const nextShare = shareMetadata
      ? await services.shareService.updateShare(shareMetadata.shareId, vm.project)
      : await services.shareService.createShare(vm.project);
    const copiedShare: ShareMetadata = { ...nextShare, status: 'copied' };
    setShareMetadata(copiedShare);
    await navigator.clipboard?.writeText(copiedShare.publicUrl);
    return copiedShare;
  }

  function presentFromSharePanel() {
    setSharePanelOpen(false);
    void vm.toggleFullscreen(workspaceRef.current);
  }

  function startPresenterMode(options?: { fromBeginning?: boolean }) {
    const pageId = options?.fromBeginning ? vm.project.pages[0]?.id : vm.activePageId;
    if (!pageId) return;
    vm.playPresentationPreview(pageId);
    void vm.toggleFullscreen(workspaceRef.current);
  }

  function getPresenterSessionService() {
    presenterSessionServiceRef.current ??= new BrowserPresenterSessionService();
    return presenterSessionServiceRef.current;
  }

  function closePresenterViewSession() {
    presenterSessionServiceRef.current?.closePresenterWindow();
    presenterFullscreenEnteredRef.current = false;
    setAudienceFullscreenPromptOpen(false);
    setPresenterRemoteSession(undefined);
    setPresenterRemotePanelOpen(false);
    setRemotePresenterActive(false);
    setPresenterSessionId(undefined);
  }

  const openPresenterView = useCallback(() => {
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
    setRemotePresenterActive(true);
    setPresenterSessionId(result.sessionId);
    setPresenterRemotePanelOpen(true);
    void service
      .openRemoteControlSession({
        presenterLabel: navigator.platform || 'Presenter device',
        ttlMs: 16 * 60 * 60 * 1000,
      })
      .then((remoteSession) => {
        setPresenterRemoteSession(remoteSession);
        service.publishState({
          activePageId: pageId,
          animationPreview: vm.animationPreview,
          presenterMode: 'presenting',
          project: vm.project,
        });
      });
    presenterFullscreenEnteredRef.current = false;
    setAudienceFullscreenPromptOpen(true);
    vm.playPresentationPreview(pageId);
    window.setTimeout(() => {
      service.publishState({
        activePageId: pageId,
        animationPreview: vm.animationPreview,
        presenterMode: 'presenting',
        project: vm.project,
      });
    }, 0);
  }, [presenterSessionId, vm]);

  function enterAudienceFullscreen() {
    setAudienceFullscreenPromptOpen(false);
    void vm.toggleFullscreen(workspaceRef.current);
  }

  const playPresentationPageAt = useCallback((index: number) => {
    const pageId = vm.project.pages[index]?.id;
    if (!pageId) return false;
    setSlideNavigatorIndex(index);
    vm.playPresentationPreview(pageId);
    return true;
  }, [vm]);

  const playRelativePresentationSlide = useCallback((offset: -1 | 1) => {
    return playPresentationPageAt(activePageIndex + offset);
  }, [activePageIndex, playPresentationPageAt]);

  function getPresentationVideos() {
    return Array.from(slideFrameRef.current?.querySelectorAll('video') ?? []);
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

  function openDesignFontList() {
    vm.setActiveTab('design');
    openLeftPanel();
    setDesignFontFocusKey((current) => current + 1);
  }

  function selectElement(elementId: string, options?: { additive?: boolean }) {
    vm.selectElement(elementId, options);
    if (!options?.additive) revealMediaSettingsForElement(elementId);
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
        vm.isFullscreen || Boolean(isPresenterPlayback && vm.animationPreview?.playing);
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
      if (
        isPreviewNavigationActive &&
        !isEditableTarget
      ) {
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
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowUp' ||
          event.key === 'PageUp';
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
  ]);

  useEffect(() => {
    return () => {
      movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
    };
  }, []);

  useEffect(() => {
    automationDelegateRef.current = vm.automation;
  }, [vm.automation]);

  useEffect(() => {
    const pageId = vm.activePageId;
    if (!pageId) return undefined;
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
        service.publishState({
          activePageId: pageId,
          animationPreview: vm.animationPreview,
          presenterMode: presenterSessionId || remotePresenterActive ? 'presenting' : 'ready',
          project: vm.project,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [presenterSessionId, remotePresenterActive, vm.activePageId, vm.animationPreview, vm.project]);

  useEffect(() => {
    if (!presenterRemoteSession) return undefined;
    return getPresenterSessionService().subscribeToCommands((message) => {
      if (message.command === 'start-presenting') {
        const firstPageId = vm.project.pages[0]?.id ?? vm.activePageId;
        setRemotePresenterActive(true);
        if (firstPageId) {
          vm.playPresentationPreview(firstPageId);
          void vm.toggleFullscreen(workspaceRef.current);
        }
        getPresenterSessionService().publishState({
          activePageId: firstPageId,
          animationPreview: vm.animationPreview,
          presenterMode: 'presenting',
          project: vm.project,
        });
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
      if (message.command === 'request-state') {
        getPresenterSessionService().publishState({
          activePageId: vm.activePageId,
          animationPreview: vm.animationPreview,
          presenterMode: presenterSessionId || remotePresenterActive ? 'presenting' : 'ready',
          project: vm.project,
        });
        return;
      }
      if (message.command === 'close') {
        closePresenterViewSession();
      }
    });
  }, [advancePresentationPreviewFromUserAction, presenterRemoteSession, presenterSessionId, remotePresenterActive, vm]);

  useEffect(() => {
    if (!presenterSessionId) {
      presenterFullscreenEnteredRef.current = false;
      return;
    }
    if (vm.isFullscreen) {
      presenterFullscreenEnteredRef.current = true;
      return;
    }
    if (presenterFullscreenEnteredRef.current) closePresenterViewSession();
  }, [presenterSessionId, vm.isFullscreen]);

  useEffect(() => {
    if (!presenterRemoteSession) return;
    getPresenterSessionService().publishState({
      activePageId: vm.activePageId,
      animationPreview: vm.animationPreview,
      presenterMode: presenterSessionId || remotePresenterActive ? 'presenting' : 'ready',
      project: vm.project,
    });
  }, [presenterRemoteSession, presenterSessionId, remotePresenterActive, vm.activePageId, vm.animationPreview, vm.project]);

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
      vm.copySelectedElements();
      editorShellBrowserUtils.writeEditorObjectClipboardMarker(event.clipboardData);
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
      vm.cutSelectedElements();
      editorShellBrowserUtils.writeEditorObjectClipboardMarker(event.clipboardData);
    }

    function handlePaste(event: ClipboardEvent) {
      if (isHistoryReadOnly) return;
      if (editorShellBrowserUtils.isEditableInteractionTarget(event.target)) return;
      event.preventDefault();
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

  useEffect(() => {
    if (!editorShellBrowserUtils.isWebMcpEnabled()) return undefined;
    const delegate: EditorAutomationDelegate = {
      createProject: (input) => automationDelegateRef.current.createProject(input),
      generateSlides: (input) => automationDelegateRef.current.generateSlides(input),
      generateImage: (input) => automationDelegateRef.current.generateImage(input),
      translateText: (input) => automationDelegateRef.current.translateText(input),
      getState: () => automationDelegateRef.current.getState(),
    };
    const adapter = new WebMcpToolAdapter(
      new editorAutomationController.EditorAutomationController(delegate),
    );
    const demoWindow = window as WebMcpDemoWindow;
    const modelContext = editorShellBrowserUtils.getWebMcpModelContext();
    demoWindow.localStudioWebMcpTools = adapter.createTools();
    const unregister = modelContext ? adapter.register(modelContext) : undefined;

    return () => {
      unregister?.();
      delete demoWindow.localStudioWebMcpTools;
    };
  }, []);

  useEffect(() => {
    const shareId = shareMetadata?.shareId;
    if (!shareId) return undefined;
    if (!publicSharingAvailable) {
      const timeoutId = window.setTimeout(() => {
        setShareMetadata((current) => (current ? { ...current, status: 'sync-failed' } : current));
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
    const timeoutId = window.setTimeout(() => {
      setShareMetadata((current) => (current ? { ...current, status: 'syncing' } : current));
      void services.shareService
        .updateShare(shareId, vm.project)
        .then((nextShare) => {
          setShareMetadata(nextShare);
        })
        .catch(() => {
          setShareMetadata((current) =>
            current ? { ...current, status: 'sync-failed' } : current,
          );
        });
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [publicSharingAvailable, services.shareService, shareMetadata?.shareId, vm.project]);

  return (
    <div className="app-shell">
      <TopToolbar
        project={vm.project}
        language={vm.activeSlideLanguage.displayCode}
        languageFlag={vm.activeSlideLanguage.flag}
        languageLabel={vm.activeSlideLanguage.label}
        canRedo={!isHistoryReadOnly && vm.canRedo}
        canUndo={!isHistoryReadOnly && vm.canUndo}
        hasSelection={!isHistoryReadOnly && hasSelection}
        persistenceEnabled={vm.persistenceEnabled}
        mirrorState={vm.mirrorState}
        mirrorDisabledBySettings={vm.mirrorDisabledBySettings}
        persistenceAttention={vm.persistenceAttention}
        persistenceNotice={vm.persistenceNotice}
        localProjectSetupPanel={
          vm.localProjectSetupOpen ? (
            <LocalProjectSetupPanel
              initialName={vm.project.name}
              onCancel={vm.closeLocalProjectSetup}
              onConfirm={(projectName) => {
                void vm.confirmLocalProjectSetup(projectName);
              }}
            />
          ) : null
        }
        lastEditedAt={vm.lastEditedAt}
        saveAnimationKey={vm.saveAnimationKey}
        canTranslateDeck={vm.canTranslateDeck}
        deckTranslationStatus={deckTranslationStatus}
        isTranslatingDeck={Boolean(vm.deckTranslationProgress)}
        translationLanguageOptions={vm.translationLanguageOptions}
        translationSourceLanguage={vm.activeSlideLanguage.code}
        translationTargetLanguage={vm.translationTargetLanguage}
        persistenceAvailable={services.persistenceAvailable}
        persistenceMode={services.persistenceMode}
        onDelete={isHistoryReadOnly ? undefined : vm.deleteSelectedElement}
        onDuplicate={isHistoryReadOnly ? undefined : vm.duplicateSelectedElement}
        onImportRemoteMirror={() => {
          void vm.importRemoteMirror();
        }}
        onImportProject={
          hasDirectoryPersistence
            ? () => {
                void vm.importProject();
              }
            : undefined
        }
        onImportPowerPoint={() => {
          void vm.importPowerPoint();
        }}
        onMirrorNow={() => {
          vm.requestMirrorNow();
        }}
        onMirrorToggle={vm.setMirrorEnabled}
        onNewProject={openBlankProjectInNewTab}
        onOpenMirrorSettings={vm.openMirrorSettings}
        onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)}
        onOpenVersionHistory={() => {
          void vm.openVersionHistory();
        }}
        onPersistenceToggle={(enabled) => {
          void vm.setPersistence(enabled);
        }}
        onProjectNameChange={isHistoryReadOnly ? undefined : vm.setProjectName}
        onRedo={isHistoryReadOnly ? undefined : vm.redo}
        onResetZoom={vm.resetZoom}
        onSelectLayers={() => {
          vm.setActiveTab('layout');
          openLeftPanel();
        }}
        onShare={() => {
          setSharePanelOpen(true);
        }}
        onOpenPresenterView={openPresenterView}
        onStartPresenterMode={startPresenterMode}
        onSaveLocal={() => {
          void vm.saveLocalNow();
        }}
        onSaveLocalAs={
          hasDirectoryPersistence
            ? () => {
                void vm.saveLocalAs();
              }
            : undefined
        }
        onSaveTheme={isHistoryReadOnly ? undefined : vm.saveTheme}
        onTranslationSourceLanguageChange={vm.setActiveSlideLanguage}
        onTranslationTargetLanguageChange={(languageCode) => {
          void vm.setTranslationTargetLanguageForSource(languageCode, {
            sourceLanguage: vm.activeSlideLanguage.code,
          });
        }}
        onTranslateDeck={
          isHistoryReadOnly
            ? undefined
            : () => {
                void vm.translateDeck();
              }
        }
        onUndo={isHistoryReadOnly ? undefined : vm.undo}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
      <div
        className={vm.pagesPanelOpen ? 'editor-grid' : 'editor-grid editor-grid-pages-collapsed'}
      >
        <LeftToolPanel
          activeTab={vm.activeTab}
          animationPreview={vm.animationPreview}
          activeSlideLanguage={vm.activeSlideLanguage}
          focusFontControlKey={designFontFocusKey}
          onTabChange={vm.setActiveTab}
          open={leftPanelOpen}
          onOpenChange={handleLeftPanelOpenChange}
          project={vm.project}
          activePageId={vm.activePageId}
          selection={vm.selection}
          availableFonts={vm.availableFonts}
          onDownloadFont={isHistoryReadOnly ? undefined : vm.downloadFontForSelection}
          onSelectElement={isHistoryReadOnly ? undefined : selectElement}
          onSetElementVisibility={isHistoryReadOnly ? undefined : vm.setElementVisibility}
          onSetElementLock={isHistoryReadOnly ? undefined : vm.setElementLock}
          onDeleteElement={isHistoryReadOnly ? undefined : vm.deleteElement}
          onReorderElement={isHistoryReadOnly ? undefined : vm.reorderElement}
          onAlignSelectedElement={isHistoryReadOnly ? undefined : vm.alignSelectedElement}
          onSetSelectedElementZOrder={isHistoryReadOnly ? undefined : vm.setSelectedElementZOrder}
          onUpdateElementFrame={isHistoryReadOnly ? undefined : vm.updateElementFrame}
          onUpdateElementStyle={isHistoryReadOnly ? undefined : vm.updateElementStyle}
          onUpdateTextContent={isHistoryReadOnly ? undefined : vm.updateTextContent}
          onUpdateMediaPlayback={isHistoryReadOnly ? undefined : vm.updateMediaPlayback}
          onUpdatePageBackground={isHistoryReadOnly ? undefined : vm.updatePageBackground}
          onChangeTheme={() => undefined}
          onApplyTheme={isHistoryReadOnly ? undefined : vm.applyTheme}
          onEditTheme={isHistoryReadOnly ? undefined : vm.editTheme}
          onApplySlideLayout={isHistoryReadOnly ? undefined : vm.applySlideLayout}
          onEditSlideLayout={isHistoryReadOnly ? undefined : vm.editSlideLayout}
          onReplaceVideoAsset={
            isHistoryReadOnly
              ? undefined
              : (elementId, file) => {
                  void vm.replaceVideoAsset(elementId, file);
                }
          }
          onClearPageTransition={isHistoryReadOnly ? undefined : vm.clearPageTransition}
          onSetPageTransition={isHistoryReadOnly ? undefined : vm.setPageTransition}
          onSetElementAnimationBuilds={isHistoryReadOnly ? undefined : vm.setElementAnimationBuilds}
          onClearElementAnimationBuild={
            isHistoryReadOnly ? undefined : vm.clearElementAnimationBuild
          }
          onReorderElementAnimationBuild={
            isHistoryReadOnly ? undefined : vm.reorderElementAnimationBuild
          }
          onPlayAnimationPreview={vm.playAnimationPreview}
          onImportImage={
            isHistoryReadOnly
              ? undefined
              : (file) => {
                  void vm.importImageFile(file);
                }
          }
          stockGifResults={vm.stockGifResults}
          stockImageResults={vm.stockImageResults}
          stockMediaError={vm.stockMediaError}
          stockMediaProviderState={vm.stockMediaProviderState}
          stockMediaRecentItems={vm.stockMediaRecentItems}
          stockMediaSearchingGifs={vm.stockMediaSearching.gifs}
          stockMediaSearchingImages={vm.stockMediaSearching.images}
          onConfigureStockMedia={vm.openMediaSettings}
          onRemoveAsset={isHistoryReadOnly ? undefined : vm.removeAsset}
          onImportMedia={isHistoryReadOnly ? undefined : importMediaFile}
          onInsertStockMedia={isHistoryReadOnly ? undefined : vm.insertStockMedia}
          onInsertText={isHistoryReadOnly ? undefined : vm.insertTextElement}
          onInsertShape={isHistoryReadOnly ? undefined : vm.insertShapeElement}
          onSearchStockGifs={(query) => {
            void vm.searchStockGifs(query);
          }}
          onSearchStockImages={(query) => {
            void vm.searchStockImages(query);
          }}
          modelStates={vm.modelStates}
          attentionModelId={
            vm.aiToolsAttentionModelId ??
            (vm.backgroundSelectionNotice ? modelSetupService.IMAGE_EDITING_MODEL_ID : undefined)
          }
          createImageOptions={vm.createImageOptions}
          translationLanguageOptions={vm.translationLanguageOptions}
          promptProviderStates={vm.promptProviderStates}
          translationProviderStates={vm.translationProviderStates}
          languageDetectionProviderStates={vm.languageDetectionProviderStates}
          languageDetectionPreparation={vm.languageDetectionPreparation}
          translationPreparation={vm.translationPreparation}
          translationTargetAttention={vm.translationTargetAttention}
          translationTargetLanguage={vm.translationTargetLanguage}
          promptApiAttention={vm.promptApiAttention}
          promptApiNotice={vm.promptApiNotice}
          promptPreparation={vm.promptPreparation}
          onDownloadModel={vm.downloadModel}
          onRemoveModel={vm.removeModel}
          onCreateImageOptionsChange={vm.setCreateImageOptions}
          onPreparePromptApi={vm.preparePromptApi}
          onPrepareLanguageDetectionProvider={vm.prepareSelectedLanguageDetectionProvider}
          onPrepareTranslationProvider={vm.prepareSelectedTranslationProvider}
          onPromptProviderChange={(providerId) => {
            void vm.setPromptProvider(providerId);
          }}
          onLanguageDetectionProviderChange={(providerId) => {
            void vm.setLanguageDetectionProvider(providerId);
          }}
          onTranslationTargetLanguageChange={(languageCode) => {
            void vm.setTranslationTargetLanguage(languageCode);
          }}
          onTranslationProviderChange={(providerId) => {
            void vm.setTranslationProvider(providerId);
          }}
        />
        <section
          className={[
            'workspace-column',
            leftPanelOpen ? 'workspace-column-left-panel-open' : '',
            vm.zoomPercent < 100 ? 'workspace-column-zoomed-out' : '',
            presentationCursorHidden ? 'workspace-column-cursor-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Canvas workspace"
          ref={workspaceRef}
        >
          {keyboardShortcutsOpen ? (
            <KeyboardShortcutsDialog
              onClose={() => setKeyboardShortcutsOpen(false)}
              onShortcutAction={executePresentationShortcut}
              supportedActions={editorShortcutActions}
            />
          ) : null}
          {slideNavigatorOpen ? (
            <div className="presentation-slide-navigator" role="dialog" aria-modal="true" aria-label="Slide navigator">
              <div className="presentation-slide-navigator-header">
                <h2>Slide Navigator</h2>
                <button
                  className="stitch-icon-button"
                  type="button"
                  aria-label="Close slide navigator"
                  onClick={() => setSlideNavigatorOpen(false)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
              <div className="presentation-slide-navigator-list" role="listbox" aria-label="Slides">
                {vm.project.pages.map((page, index) => (
                  <button
                    aria-selected={index === slideNavigatorIndex}
                    className={
                      index === slideNavigatorIndex
                        ? 'presentation-slide-navigator-item presentation-slide-navigator-item-active'
                        : 'presentation-slide-navigator-item'
                    }
                    key={page.id}
                    type="button"
                    role="option"
                    onClick={() => setSlideNavigatorIndex(index)}
                    onDoubleClick={() => {
                      playPresentationPageAt(index);
                      setSlideNavigatorOpen(false);
                    }}
                  >
                    <span>Slide {index + 1}</span>
                    <strong>{page.name}</strong>
                  </button>
                ))}
              </div>
            </div>
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
              Slide {activePageIndex + 1} of {vm.project.pages.length}
            </div>
          ) : null}
          <ScrollingCanvasWorkspace
            project={vm.project}
            activePageId={vm.activePageId}
            selection={vm.selection}
            slideFrameRef={slideFrameRef}
            stageRef={stageRef}
            presentationMode={vm.isFullscreen || vm.animationPreview?.mode === 'presenter'}
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
            onAlignSelectedElement={
              isHistoryReadOnly
                ? undefined
                : () => {
                    vm.alignSelectedElement('page-center');
                  }
            }
            onAnimationPreviewAdvance={
              vm.isFullscreen || vm.animationPreview?.mode === 'presenter'
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
            onClearSelection={isHistoryReadOnly ? undefined : vm.clearSelection}
            onSelectPresentation={isHistoryReadOnly ? undefined : vm.selectPresentation}
            onSelectSlide={isHistoryReadOnly ? undefined : vm.selectSlideBackground}
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
            onUpdateTextContent={isHistoryReadOnly ? undefined : vm.updateTextContent}
            onActivePageFromScroll={vm.activateScrolledPage}
            onAddPage={isHistoryReadOnly ? undefined : vm.addPage}
            onDeletePage={isHistoryReadOnly ? undefined : vm.deletePage}
            onDuplicatePage={isHistoryReadOnly ? undefined : vm.duplicatePage}
            onRenamePage={isHistoryReadOnly ? undefined : vm.renamePage}
            onReorderPage={isHistoryReadOnly ? undefined : vm.reorderPage}
            onSetPageVisibility={isHistoryReadOnly ? undefined : vm.setPageVisibility}
          />
          {activePage ? (
            <section className="speaker-notes-editor" aria-label="Speaker notes editor">
              {speakerNotesOpen ? (
                <div className="speaker-notes-card">
                  <header className="speaker-notes-header">
                    <h2>
                      Page {activePageIndex + 1} - {activePage.name}
                    </h2>
                    <div className="speaker-notes-actions ew-compact-row">
                      <button type="button" aria-label="Change notes text size">
                        aA
                      </button>
                      <button
                        type="button"
                        aria-label="Close notes panel"
                        onClick={() => setSpeakerNotesOpen(false)}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          close
                        </span>
                      </button>
                    </div>
                  </header>
                  <textarea
                    id="speaker-notes-textarea"
                    aria-label="Speaker notes"
                    maxLength={5000}
                    placeholder="Add notes to your design"
                    value={activePage.speakerNotes ?? ''}
                    onChange={(event) =>
                      vm.updatePageSpeakerNotes(activePage.id, event.target.value)
                    }
                  />
                  <span className="speaker-notes-count">{activePage.speakerNotes?.length ?? 0}/5000</span>
                </div>
              ) : null}
            </section>
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
            <div className="audience-fullscreen-backdrop" role="presentation">
              <section
                className="audience-fullscreen-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="audience-fullscreen-title"
              >
                <button
                  className="audience-fullscreen-close"
                  type="button"
                  aria-label="Close audience fullscreen prompt"
                  onClick={closePresenterViewSession}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    close
                  </span>
                </button>
                <h2 id="audience-fullscreen-title">Audience Window</h2>
                <p>
                  This window is what your audience sees. Drag it to the screen your
                  audience will be looking at and enter full screen mode.
                </p>
                <button
                  className="audience-fullscreen-primary"
                  type="button"
                  onClick={enterAudienceFullscreen}
                >
                  Enter full screen mode
                </button>
              </section>
            </div>
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
              generationNotice={vm.promptGenerationNotice}
              generationStatus={vm.promptGenerationStatus}
              isGeneratingImage={vm.isGeneratingImage}
              isGeneratingSlide={vm.isGeneratingSlide}
              selectedImageElementId={vm.selectedImagePromptElementId}
              onCreateImagePromptIntent={() => vm.ensureImageGenerationReadyForPrompt()}
              onCreateImageSubmit={(prompt, options) => vm.generateImageFromPrompt(prompt, options)}
              onSlidePromptSubmit={(prompt) => vm.generateSlideFromPrompt(prompt)}
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
          share={shareMetadata}
          onClose={() => {
            setSharePanelOpen(false);
          }}
          onCopyLink={copyPublicShareLink}
          publicLinkUnavailableReason={
            publicSharingAvailable ? undefined : publicSharingUnavailableReason
          }
          onDownload={exportCurrentPageAsPng}
          onPresent={presentFromSharePanel}
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
          mirrorState={vm.mirrorState}
          mirrorDisabledBySettings={vm.mirrorDisabledBySettings}
          onBack={() => {
            vm.closeMirrorSettings();
            vm.openSettings();
          }}
          onClose={vm.closeMirrorSettings}
          onEnabledChange={vm.setMirrorEnabledFromSettings}
          onSave={vm.saveMirrorConfig}
          onTestConnection={vm.testMirrorConnection}
        />
      ) : null}
      {vm.remoteImportOpen ? (
        <RemoteImportPanel
          error={vm.remoteImportError}
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
        activePageIndex={activePageIndex}
        notesOpen={speakerNotesOpen}
        pageCount={vm.project.pages.length}
        pagesPanelOpen={vm.pagesPanelOpen}
        zoomPercent={vm.zoomPercent}
        onResetZoom={vm.resetZoom}
        onOpenSettings={vm.openSettings}
        onToggleNotes={() => setSpeakerNotesOpen((current) => !current)}
        onTogglePagesPanel={togglePagesPanel}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
    </div>
  );
}
