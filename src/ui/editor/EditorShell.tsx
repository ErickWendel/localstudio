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
        onSelectLayers={() => {
          vm.setActiveTab('layout');
        }}
      />
      <div className="editor-grid">
        <PageRail project={vm.project} activePageId={vm.activePageId} />
        <section className="workspace-column" aria-label="Canvas workspace">
          <CanvasWorkspace
            project={vm.project}
            activePageId={vm.activePageId}
            selection={vm.selection}
            onSelectElement={vm.selectElement}
            onUpdateElementFrame={vm.updateElementFrame}
            onUpdateTextContent={vm.updateTextContent}
          />
          <PromptBar />
        </section>
        <RightPanel
          activeTab={vm.activeTab}
          onTabChange={vm.setActiveTab}
          modelStates={vm.modelStates}
          onDownloadRequiredModels={vm.downloadRequiredModels}
        />
      </div>
    </div>
  );
}
