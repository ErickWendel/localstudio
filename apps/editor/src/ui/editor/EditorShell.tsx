import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { AppServices } from '../../app/composition';
import { IMAGE_EDITING_MODEL_ID } from '../../services/modelSetupService';
import { EditorFooter } from './EditorFooter';
import { LeftToolPanel } from './LeftToolPanel';
import { PagesPanel } from './PagesPanel';
import { PromptBar } from './PromptBar';
import { ScrollingCanvasWorkspace } from './ScrollingCanvasWorkspace';
import { TopToolbar } from './TopToolbar';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { useEditorViewModel } from './useEditorViewModel';

interface EditorShellProps {
  services: AppServices;
}

const EDITOR_OBJECT_CLIPBOARD_TYPE = 'application/x-localstudio-editor-elements';
const EDITOR_OBJECT_CLIPBOARD_MARKER = '1';

function isEditablePasteTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function getClipboardImageFile(clipboardData: DataTransfer | null) {
  if (!clipboardData) return undefined;

  const fileFromFiles = Array.from(clipboardData.files).find((file) => file.type.startsWith('image/'));
  if (fileFromFiles) return fileFromFiles;

  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return undefined;
}

function hasEditorObjectClipboardMarker(clipboardData: DataTransfer | null) {
  if (!clipboardData) return false;
  if (clipboardData.types && Array.from(clipboardData.types).includes(EDITOR_OBJECT_CLIPBOARD_TYPE)) {
    return true;
  }
  return clipboardData.getData?.(EDITOR_OBJECT_CLIPBOARD_TYPE) === EDITOR_OBJECT_CLIPBOARD_MARKER;
}

function writeEditorObjectClipboardMarker(clipboardData: DataTransfer | null) {
  if (!clipboardData) return;
  clipboardData.setData(EDITOR_OBJECT_CLIPBOARD_TYPE, EDITOR_OBJECT_CLIPBOARD_MARKER);
  clipboardData.setData('text/plain', 'LocalStudio.ai editor elements');
}

export function EditorShell({ services }: EditorShellProps) {
  const vm = useEditorViewModel(services);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const slideFrameRef = useRef<HTMLDivElement>(null);
  const toolbarImageInputRef = useRef<HTMLInputElement>(null);
  const hasSelection = vm.selection.elementIds.length > 0;
  const isHistoryReadOnly = vm.versionHistoryOpen;
  const activePageIndex = Math.max(0, vm.project.pages.findIndex((page) => page.id === vm.activePageId));

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
        if (isEditablePasteTarget(event.target)) return;
        event.preventDefault();
        vm.selectAllElementsOnActivePage();
        return;
      }

      if (event.key === 'Escape' && (vm.backgroundSelectionMode || vm.backgroundSelectionNotice)) {
        event.preventDefault();
        vm.cancelBackgroundSelectionMode();
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
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
    function handleCopy(event: ClipboardEvent) {
      if (isHistoryReadOnly) return;
      if (isEditablePasteTarget(event.target) || !hasSelection) return;
      event.preventDefault();
      vm.copySelectedElements();
      writeEditorObjectClipboardMarker(event.clipboardData);
    }

    function handleCut(event: ClipboardEvent) {
      if (isHistoryReadOnly) return;
      if (isEditablePasteTarget(event.target) || !hasSelection) return;
      event.preventDefault();
      vm.cutSelectedElements();
      writeEditorObjectClipboardMarker(event.clipboardData);
    }

    function handlePaste(event: ClipboardEvent) {
      if (isHistoryReadOnly) return;
      if (isEditablePasteTarget(event.target)) return;
      event.preventDefault();
      if (hasEditorObjectClipboardMarker(event.clipboardData) && vm.pasteCopiedElements()) return;
      const imageFile = getClipboardImageFile(event.clipboardData);
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
        lastEditedAt={vm.lastEditedAt}
        saveAnimationKey={vm.saveAnimationKey}
        canTranslateDeck={vm.canTranslateDeck}
        onDelete={isHistoryReadOnly ? undefined : vm.deleteSelectedElement}
        onDuplicate={isHistoryReadOnly ? undefined : vm.duplicateSelectedElement}
        onExport={exportCurrentPageAsPng}
        onImportProject={() => {
          void vm.importProject();
        }}
        onNewProject={openBlankProjectInNewTab}
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
        onTranslateDeck={isHistoryReadOnly ? undefined : () => {
          void vm.translateDeck();
        }}
        onUndo={isHistoryReadOnly ? undefined : vm.undo}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
      <div className={vm.pagesPanelOpen ? 'editor-grid' : 'editor-grid editor-grid-pages-collapsed'}>
        <LeftToolPanel
          activeTab={vm.activeTab}
          activeSlideLanguage={vm.activeSlideLanguage}
          onTabChange={vm.setActiveTab}
          open={leftPanelOpen}
          onOpenChange={setLeftPanelOpen}
          project={vm.project}
          activePageId={vm.activePageId}
          selection={vm.selection}
          onSelectElement={isHistoryReadOnly ? undefined : vm.selectElement}
          onSetElementVisibility={isHistoryReadOnly ? undefined : vm.setElementVisibility}
          onSetElementLock={isHistoryReadOnly ? undefined : vm.setElementLock}
          onDeleteElement={isHistoryReadOnly ? undefined : vm.deleteElement}
          onReorderElement={isHistoryReadOnly ? undefined : vm.reorderElement}
          onUpdateElementStyle={isHistoryReadOnly ? undefined : vm.updateElementStyle}
          onUpdatePageBackground={isHistoryReadOnly ? undefined : vm.updatePageBackground}
          onImportImage={isHistoryReadOnly ? undefined : (file) => {
            void vm.importImageFile(file);
          }}
          onInsertText={isHistoryReadOnly ? undefined : vm.insertTextElement}
          modelStates={vm.modelStates}
          attentionModelId={vm.aiToolsAttentionModelId ?? (vm.backgroundSelectionNotice ? IMAGE_EDITING_MODEL_ID : undefined)}
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
          className="workspace-column"
          aria-label="Canvas workspace"
          ref={workspaceRef}
        >
          <ScrollingCanvasWorkspace
            project={vm.project}
            activePageId={vm.activePageId}
            selection={vm.selection}
            slideFrameRef={slideFrameRef}
            stageRef={stageRef}
            presentationMode={vm.isFullscreen}
            readOnly={isHistoryReadOnly}
            zoomPercent={vm.zoomPercent}
            backgroundSelectionMode={vm.backgroundSelectionMode}
            backgroundSelectionNotice={vm.backgroundSelectionNotice}
            processingElementIds={vm.processingElementIds}
            backgroundPreview={vm.backgroundPreview}
            backgroundPreparation={vm.backgroundPreparation}
            canTranslateCurrentSlide={vm.canTranslateCurrentSlide}
            canTranslateSelection={vm.canTranslateSelection}
            isTranslating={vm.isTranslating}
            translationNotice={vm.translationNotice}
            onAlignSelectedElement={isHistoryReadOnly ? undefined : () => {
              vm.alignSelectedElement('page-center');
            }}
            onBackgroundSelectionToggle={isHistoryReadOnly ? undefined : vm.toggleBackgroundSelectionMode}
            onBackgroundSubjectPick={isHistoryReadOnly ? undefined : (elementId, point) => {
              void vm.pickBackgroundSubject(elementId, point);
            }}
            onBackgroundPreviewPoint={isHistoryReadOnly ? undefined : vm.previewBackgroundSubject}
            onBackgroundRefinePoint={isHistoryReadOnly ? undefined : vm.refineBackgroundSubject}
            onBringSelectedElementForward={isHistoryReadOnly ? undefined : () => {
              vm.setSelectedElementZOrder('forward');
            }}
            onCancelBackgroundSelection={isHistoryReadOnly ? undefined : vm.cancelBackgroundSelectionMode}
            onClearSelection={isHistoryReadOnly ? undefined : vm.clearSelection}
            onDeleteSelectedElement={isHistoryReadOnly ? undefined : vm.deleteSelectedElement}
            onDuplicateSelectedElement={isHistoryReadOnly ? undefined : vm.duplicateSelectedElement}
            onFlipSelectedImage={isHistoryReadOnly ? undefined : vm.flipSelectedImage}
            onInsertImage={isHistoryReadOnly ? undefined : () => {
              toolbarImageInputRef.current?.click();
            }}
            onInsertText={isHistoryReadOnly ? undefined : () => {
              vm.insertTextElement();
            }}
            onSelectElement={isHistoryReadOnly ? undefined : vm.selectElement}
            onSendSelectedElementBackward={isHistoryReadOnly ? undefined : () => {
              vm.setSelectedElementZOrder('backward');
            }}
            onTranslatePage={isHistoryReadOnly ? undefined : (pageId) => {
              void vm.translatePage(pageId);
            }}
            onTranslateSelectedText={isHistoryReadOnly ? undefined : () => {
              void vm.translateSelectedText();
            }}
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
            aria-label="Insert image file"
            className="visually-hidden-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file || isHistoryReadOnly) return;
              void vm.importImageFile(file);
              event.target.value = '';
            }}
          />
          {!isHistoryReadOnly ? <PromptBar
            createImageNotice={vm.createImageNotice}
            createImageStatus={vm.createImageStatus}
            createImageOptions={vm.createImageOptions}
            generationNotice={vm.promptGenerationNotice}
            generationStatus={vm.promptGenerationStatus}
            isGeneratingImage={vm.isGeneratingImage}
            isGeneratingSlide={vm.isGeneratingSlide}
            onCreateImagePromptIntent={() => vm.ensureImageGenerationReadyForPrompt()}
            onCreateImageSubmit={(prompt, options) => vm.generateImageFromPrompt(prompt, options)}
            onSlidePromptSubmit={(prompt) => vm.generateSlideFromPrompt(prompt)}
            onStopGeneration={vm.stopPromptGeneration}
          /> : null}
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
            onTranslatePage={isHistoryReadOnly ? undefined : (pageId) => {
              void vm.translatePage(pageId);
            }}
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
      <EditorFooter
        activePageIndex={activePageIndex}
        isFullscreen={vm.isFullscreen}
        pageCount={vm.project.pages.length}
        pagesPanelOpen={vm.pagesPanelOpen}
        zoomPercent={vm.zoomPercent}
        onResetZoom={vm.resetZoom}
        onToggleFullscreen={() => {
          void vm.toggleFullscreen(slideFrameRef.current);
        }}
        onTogglePagesPanel={vm.togglePagesPanel}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
    </div>
  );
}
