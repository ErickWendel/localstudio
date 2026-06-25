import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import type { AppServices } from '../../app/composition';
import { IMAGE_EDITING_MODEL_ID } from '../../services/modelSetupService';
import { CanvasWorkspace } from './CanvasWorkspace';
import { PageRail } from './PageRail';
import { PromptBar } from './PromptBar';
import { RightPanel } from './RightPanel';
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
  const stageRef = useRef<Konva.Stage>(null);
  const toolbarImageInputRef = useRef<HTMLInputElement>(null);
  const hasSelection = vm.selection.elementIds.length > 0;

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
        zoomPercent={vm.zoomPercent}
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
        }}
        onTranslateDeck={() => {
          void vm.translateDeck();
        }}
        onUndo={vm.undo}
        onZoomIn={vm.zoomIn}
        onZoomOut={vm.zoomOut}
      />
      <div className="editor-grid">
        <PageRail
          project={vm.project}
          activePageId={vm.activePageId}
          onAddPage={vm.addPage}
          onImportImage={(file) => {
            void vm.importImageFile(file);
          }}
          onSelectPage={vm.selectPage}
        />
        <section
          className="workspace-column"
          aria-label="Canvas workspace"
        >
          <CanvasWorkspace
            project={vm.project}
            activePageId={vm.activePageId}
            selection={vm.selection}
            stageRef={stageRef}
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
            onInsertImage={() => {
              toolbarImageInputRef.current?.click();
            }}
            onInsertText={vm.insertTextElement}
            onSelectElement={vm.selectElement}
            onSendSelectedElementBackward={() => {
              vm.setSelectedElementZOrder('backward');
            }}
            onTranslateCurrentSlide={() => {
              void vm.translateCurrentSlide();
            }}
            onTranslateSelectedText={() => {
              void vm.translateSelectedText();
            }}
            onUpdateElementFrame={vm.updateElementFrame}
            onUpdateElementFrames={vm.updateElementFrames}
            onUpdateTextContent={vm.updateTextContent}
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
        <RightPanel
          activeTab={vm.activeTab}
          onTabChange={vm.setActiveTab}
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
      </div>
    </div>
  );
}
