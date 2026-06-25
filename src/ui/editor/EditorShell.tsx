import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import type { AppServices } from '../../app/composition';
import { CanvasWorkspace } from './CanvasWorkspace';
import { PageRail } from './PageRail';
import { PromptBar } from './PromptBar';
import { RightPanel } from './RightPanel';
import { TopToolbar } from './TopToolbar';
import { useEditorViewModel } from './useEditorViewModel';

interface EditorShellProps {
  services: AppServices;
}

export function EditorShell({ services }: EditorShellProps) {
  const vm = useEditorViewModel(services);
  const stageRef = useRef<Konva.Stage>(null);
  const hasSelection = vm.selection.elementIds.length > 0;

  function exportCurrentPageAsPng() {
    const dataUrl = stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
    if (!dataUrl) return;
    services.exportService.downloadDataUrl(
      dataUrl,
      services.exportService.getPageImageFileName(vm.project, vm.activePageId, 'png'),
    );
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

  return (
    <div className="app-shell">
      <TopToolbar
        project={vm.project}
        language="PT-BR"
        canRedo={vm.canRedo}
        canUndo={vm.canUndo}
        hasSelection={hasSelection}
        persistenceEnabled={vm.persistenceEnabled}
        zoomPercent={vm.zoomPercent}
        onDelete={vm.deleteSelectedElement}
        onDuplicate={vm.duplicateSelectedElement}
        onExport={exportCurrentPageAsPng}
        onPersistenceToggle={vm.setPersistence}
        onProjectNameChange={vm.setProjectName}
        onRedo={vm.redo}
        onResetZoom={vm.resetZoom}
        onSelectLayers={() => {
          vm.setActiveTab('layout');
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
          onPaste={(event) => {
            const imageFile =
              Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/')) ??
              Array.from(event.clipboardData.items)
                .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
                ?.getAsFile();

            if (!imageFile) return;
            event.preventDefault();
            void vm.importImageFile(imageFile);
          }}
        >
          <CanvasWorkspace
            project={vm.project}
            activePageId={vm.activePageId}
            selection={vm.selection}
            stageRef={stageRef}
            zoomPercent={vm.zoomPercent}
            onAlignSelectedElement={() => {
              vm.alignSelectedElement('page-center');
            }}
            onBringSelectedElementForward={() => {
              vm.setSelectedElementZOrder('forward');
            }}
            onDeleteSelectedElement={vm.deleteSelectedElement}
            onDuplicateSelectedElement={vm.duplicateSelectedElement}
            onSelectElement={vm.selectElement}
            onSendSelectedElementBackward={() => {
              vm.setSelectedElementZOrder('backward');
            }}
            onUpdateElementFrame={vm.updateElementFrame}
            onUpdateTextContent={vm.updateTextContent}
          />
          <PromptBar />
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
          modelStates={vm.modelStates}
          onDownloadRequiredModels={vm.downloadRequiredModels}
        />
      </div>
    </div>
  );
}
