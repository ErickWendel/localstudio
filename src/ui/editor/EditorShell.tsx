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
  }, [hasSelection, vm]);

  useEffect(() => {
    function handleCopy(event: ClipboardEvent) {
      if (isEditablePasteTarget(event.target) || !hasSelection) return;
      event.preventDefault();
      vm.copySelectedElements();
      writeEditorObjectClipboardMarker(event.clipboardData);
    }

    function handleCut(event: ClipboardEvent) {
      if (isEditablePasteTarget(event.target) || !hasSelection) return;
      event.preventDefault();
      vm.cutSelectedElements();
      writeEditorObjectClipboardMarker(event.clipboardData);
    }

    function handlePaste(event: ClipboardEvent) {
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
  }, [hasSelection, vm]);

  return (
    <div className="app-shell">
      <TopToolbar
        project={vm.project}
        language={vm.activeSlideLanguage.displayCode}
        languageFlag={vm.activeSlideLanguage.flag}
        languageLabel={vm.activeSlideLanguage.label}
        canRedo={vm.canRedo}
        canUndo={vm.canUndo}
        hasSelection={hasSelection}
        persistenceEnabled={vm.persistenceEnabled}
        canTranslateDeck={vm.canTranslateDeck}
        onDelete={vm.deleteSelectedElement}
        onDuplicate={vm.duplicateSelectedElement}
        onExport={exportCurrentPageAsPng}
        onImportProject={() => {
          void vm.importProject();
        }}
        onNewProject={openBlankProjectInNewTab}
        onPersistenceToggle={(enabled) => {
          void vm.setPersistence(enabled);
        }}
        onProjectNameChange={vm.setProjectName}
        onRedo={vm.redo}
        onResetZoom={vm.resetZoom}
        onSelectLayers={() => {
          vm.setActiveTab('layout');
          setLeftPanelOpen(true);
        }}
        onTranslateDeck={() => {
          void vm.translateDeck();
        }}
        onUndo={vm.undo}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
      <div className={vm.pagesPanelOpen ? 'editor-grid' : 'editor-grid editor-grid-pages-collapsed'}>
        <LeftToolPanel
          activeTab={vm.activeTab}
          onTabChange={vm.setActiveTab}
          open={leftPanelOpen}
          onOpenChange={setLeftPanelOpen}
          project={vm.project}
          activePageId={vm.activePageId}
          selection={vm.selection}
          onSelectElement={vm.selectElement}
          onSetElementVisibility={vm.setElementVisibility}
          onSetElementLock={vm.setElementLock}
          onDeleteElement={vm.deleteElement}
          onReorderElement={vm.reorderElement}
          onUpdateElementStyle={vm.updateElementStyle}
          onUpdatePageBackground={vm.updatePageBackground}
          onImportImage={(file) => {
            void vm.importImageFile(file);
          }}
          onInsertText={vm.insertTextElement}
          modelStates={vm.modelStates}
          attentionModelId={vm.aiToolsAttentionModelId ?? (vm.backgroundSelectionNotice ? IMAGE_EDITING_MODEL_ID : undefined)}
          createImageOptions={vm.createImageOptions}
          translationLanguageOptions={vm.translationLanguageOptions}
          translationPreparation={vm.translationPreparation}
          translationTargetAttention={vm.translationTargetAttention}
          translationTargetLanguage={vm.translationTargetLanguage}
          promptApiAttention={vm.promptApiAttention}
          promptApiNotice={vm.promptApiNotice}
          promptPreparation={vm.promptPreparation}
          onDownloadModel={vm.downloadModel}
          onCreateImageOptionsChange={vm.setCreateImageOptions}
          onPreparePromptApi={vm.preparePromptApi}
          onTranslationTargetLanguageChange={(languageCode) => {
            void vm.setTranslationTargetLanguage(languageCode);
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
            onAlignSelectedElement={() => {
              vm.alignSelectedElement('page-center');
            }}
            onBackgroundSelectionToggle={vm.toggleBackgroundSelectionMode}
            onBackgroundSubjectPick={(elementId, point) => {
              void vm.pickBackgroundSubject(elementId, point);
            }}
            onBackgroundPreviewPoint={vm.previewBackgroundSubject}
            onBackgroundRefinePoint={vm.refineBackgroundSubject}
            onBringSelectedElementForward={() => {
              vm.setSelectedElementZOrder('forward');
            }}
            onCancelBackgroundSelection={vm.cancelBackgroundSelectionMode}
            onClearSelection={vm.clearSelection}
            onDeleteSelectedElement={vm.deleteSelectedElement}
            onDuplicateSelectedElement={vm.duplicateSelectedElement}
            onFlipSelectedImage={vm.flipSelectedImage}
            onInsertImage={() => {
              toolbarImageInputRef.current?.click();
            }}
            onInsertText={() => {
              vm.insertTextElement();
            }}
            onSelectElement={vm.selectElement}
            onSendSelectedElementBackward={() => {
              vm.setSelectedElementZOrder('backward');
            }}
            onTranslatePage={(pageId) => {
              void vm.translatePage(pageId);
            }}
            onTranslateSelectedText={() => {
              void vm.translateSelectedText();
            }}
            onUpdateElementFrame={vm.updateElementFrame}
            onUpdateElementFrames={vm.updateElementFrames}
            onUpdateElementStyle={vm.updateElementStyle}
            onUpdateTextContent={vm.updateTextContent}
            onActivePageFromScroll={vm.activateScrolledPage}
            onAddPage={vm.addPage}
            onDeletePage={vm.deletePage}
            onDuplicatePage={vm.duplicatePage}
            onRenamePage={vm.renamePage}
            onReorderPage={vm.reorderPage}
            onSetPageVisibility={vm.setPageVisibility}
          />
          <input
            ref={toolbarImageInputRef}
            aria-label="Insert image file"
            className="visually-hidden-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void vm.importImageFile(file);
              event.target.value = '';
            }}
          />
          <PromptBar
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
          />
        </section>
        {vm.pagesPanelOpen ? (
          <PagesPanel
            project={vm.project}
            activePageId={vm.activePageId}
            canTranslate={vm.canTranslateDeck}
            onAddPage={vm.addPage}
            onClose={vm.togglePagesPanel}
            onDeletePage={vm.deletePage}
            onDuplicatePage={vm.duplicatePage}
            onRenamePage={vm.renamePage}
            onReorderPage={vm.reorderPage}
            onSelectPage={vm.selectPage}
            onSetPageVisibility={vm.setPageVisibility}
            onTranslatePage={(pageId) => {
              void vm.translatePage(pageId);
            }}
          />
        ) : null}
      </div>
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
