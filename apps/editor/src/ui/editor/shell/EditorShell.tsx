import { useEffect, useRef, useState } from 'react';
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
import { LeftToolPanel } from '../panels/LeftToolPanel';
import { LocalProjectSetupPanel } from '../panels/LocalProjectSetupPanel';
import { MirrorSettingsPanel } from '../panels/MirrorSettingsPanel';
import { PagesPanel } from '../panels/PagesPanel';
import { PromptBar } from '../prompting/PromptBar';
import { RemoteImportPanel } from '../panels/RemoteImportPanel';
import { ScrollingCanvasWorkspace } from '../canvas/ScrollingCanvasWorkspace';
import { SettingsPanel } from '../panels/SettingsPanel';
import { TopToolbar } from '../toolbars/TopToolbar';
import { VersionHistoryPanel } from '../panels/VersionHistoryPanel';
import { useEditorViewModel } from '../state/useEditorViewModel';
import { SharePanel } from '../../share/SharePanel';
import { editorShellBrowserUtils } from '../browser/editorShellBrowserUtils';

interface EditorShellProps {
  services: AppServices;
}

export function EditorShell({ services }: EditorShellProps) {
  const vm = useEditorViewModel(services);
  const automationDelegateRef = useRef(vm.automation);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareMetadata, setShareMetadata] = useState<ShareMetadata | undefined>();
  const stageRef = useRef<Konva.Stage>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const slideFrameRef = useRef<HTMLDivElement>(null);
  const toolbarImageInputRef = useRef<HTMLInputElement>(null);
  const hasSelection = vm.selection.elementIds.length > 0;
  const isHistoryReadOnly = vm.versionHistoryOpen;
  const activePageIndex = Math.max(
    0,
    vm.project.pages.findIndex((page) => page.id === vm.activePageId),
  );
  const publicSharingAvailable = vm.mirrorState.enabled && vm.mirrorState.status === 'synced';
  const publicSharingUnavailableReason =
    'Public links cannot be created without remote storage.';
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

  function isAnimatedMediaFile(file: File) {
    return file.type === 'image/gif' || file.type.startsWith('video/');
  }

  function revealMediaSettingsForElement(elementId: string) {
    const selectedElement = vm.project.elements[elementId];
    if (selectedElement?.type !== 'gif' && selectedElement?.type !== 'video') return;
    vm.setActiveTab('design');
    setLeftPanelOpen(true);
  }

  function selectElement(elementId: string, options?: { additive?: boolean }) {
    vm.selectElement(elementId, options);
    if (!options?.additive) revealMediaSettingsForElement(elementId);
  }

  function importMediaFile(file: File) {
    if (isAnimatedMediaFile(file)) {
      vm.setActiveTab('design');
      setLeftPanelOpen(true);
    }
    void vm.importMediaFile(file);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHistoryReadOnly) return;
      const isUndoShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
      const isRedoShortcut =
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && event.shiftKey) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y');
      if (isUndoShortcut || isRedoShortcut) {
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
      if (
        isPreviewNavigationActive &&
        !editorShellBrowserUtils.isEditableInteractionTarget(event.target)
      ) {
        const isNextPreviewKey =
          event.key === 'ArrowRight' ||
          event.key === 'ArrowDown' ||
          event.key === 'PageDown' ||
          event.key === ' ' ||
          event.key === 'Enter';
        const isPreviousPreviewKey =
          event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp';
        if (isNextPreviewKey || isPreviousPreviewKey) {
          event.preventDefault();
          if (isNextPreviewKey) vm.advancePresentationPreview();
          if (isPreviousPreviewKey) vm.rewindPresentationPreview();
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

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasSelection, isHistoryReadOnly, vm]);

  useEffect(() => {
    automationDelegateRef.current = vm.automation;
  }, [vm.automation]);

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
        onMirrorNow={() => {
          vm.requestMirrorNow();
        }}
        onMirrorToggle={vm.setMirrorEnabled}
        onNewProject={openBlankProjectInNewTab}
        onOpenMirrorSettings={vm.openMirrorSettings}
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
          setLeftPanelOpen(true);
        }}
        onShare={() => {
          setSharePanelOpen(true);
        }}
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
          onTabChange={vm.setActiveTab}
          open={leftPanelOpen}
          onOpenChange={setLeftPanelOpen}
          project={vm.project}
          activePageId={vm.activePageId}
          selection={vm.selection}
          onSelectElement={isHistoryReadOnly ? undefined : selectElement}
          onSetElementVisibility={isHistoryReadOnly ? undefined : vm.setElementVisibility}
          onSetElementLock={isHistoryReadOnly ? undefined : vm.setElementLock}
          onDeleteElement={isHistoryReadOnly ? undefined : vm.deleteElement}
          onReorderElement={isHistoryReadOnly ? undefined : vm.reorderElement}
          onUpdateElementStyle={isHistoryReadOnly ? undefined : vm.updateElementStyle}
          onUpdateMediaPlayback={isHistoryReadOnly ? undefined : vm.updateMediaPlayback}
          onUpdatePageBackground={isHistoryReadOnly ? undefined : vm.updatePageBackground}
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
          onRemoveAsset={isHistoryReadOnly ? undefined : vm.removeAsset}
          onImportMedia={isHistoryReadOnly ? undefined : importMediaFile}
          onInsertText={isHistoryReadOnly ? undefined : vm.insertTextElement}
          onInsertShape={isHistoryReadOnly ? undefined : vm.insertShapeElement}
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
          className={
            leftPanelOpen ? 'workspace-column workspace-column-left-panel-open' : 'workspace-column'
          }
          aria-label="Canvas workspace"
          ref={workspaceRef}
        >
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
                    setLeftPanelOpen(true);
                  }
            }
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
          <input
            ref={toolbarImageInputRef}
            aria-label="Insert media file"
            className="visually-hidden-input"
            type="file"
            accept="image/*,video/*"
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
            onClose={vm.togglePagesPanel}
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
        <SettingsPanel onClose={vm.closeSettings} onOpenMirrorSettings={vm.openMirrorSettings} />
      ) : null}
      {vm.mirrorSettingsOpen ? (
        <MirrorSettingsPanel
          config={vm.mirrorConfig}
          mirrorState={vm.mirrorState}
          mirrorDisabledBySettings={vm.mirrorDisabledBySettings}
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
      <EditorFooter
        activePageIndex={activePageIndex}
        pageCount={vm.project.pages.length}
        pagesPanelOpen={vm.pagesPanelOpen}
        zoomPercent={vm.zoomPercent}
        onResetZoom={vm.resetZoom}
        onOpenSettings={vm.openSettings}
        onTogglePagesPanel={vm.togglePagesPanel}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
    </div>
  );
}
