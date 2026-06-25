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

  return (
    <div className="app-shell">
      <TopToolbar
        project={vm.project}
        language="PT-BR"
        canRedo={vm.canRedo}
        canUndo={vm.canUndo}
        zoomPercent={vm.zoomPercent}
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
            zoomPercent={vm.zoomPercent}
            onSelectElement={vm.selectElement}
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
