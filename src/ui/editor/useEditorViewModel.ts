import { useEffect, useMemo, useState } from 'react';
import type { AppServices } from '../../app/composition';
import { UpdateElementFrameCommand, type ElementFramePatch } from '../../domain/commands/basicCommands';
import type { ProjectDocument, SelectionState } from '../../domain/model';
import type { ModelState } from '../../services/interfaces';

export type RightPanelTab = 'design' | 'layers' | 'ai-tools';

export function useEditorViewModel(services: AppServices) {
  const [project, setProject] = useState<ProjectDocument>(services.initialProject);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('ai-tools');
  const [modelStates, setModelStates] = useState<ModelState[]>([]);
  const [hasLoadedProject, setHasLoadedProject] = useState(false);
  const activePageId = project.pages[0]?.id ?? '';
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>(['image-hero']);
  const selection = useMemo<SelectionState>(() => ({ pageId: activePageId, elementIds: selectedElementIds }), [
    activePageId,
    selectedElementIds,
  ]);

  useEffect(() => {
    void services.modelSetupService.getModelStates().then(setModelStates);
  }, [services.modelSetupService]);

  useEffect(() => {
    let isMounted = true;

    void services.projectRepository.loadProject().then((savedProject) => {
      if (!isMounted) return;
      if (savedProject) setProject(savedProject);
      setHasLoadedProject(true);
    });

    return () => {
      isMounted = false;
    };
  }, [services.projectRepository]);

  useEffect(() => {
    if (!hasLoadedProject) return;
    void services.projectRepository.saveProject(project);
  }, [hasLoadedProject, project, services.projectRepository]);

  async function downloadRequiredModels() {
    const next = await services.modelSetupService.downloadRequiredModels();
    setModelStates(next);
  }

  function selectElement(elementId: string) {
    setSelectedElementIds([elementId]);
  }

  function updateElementFrame(elementId: string, patch: ElementFramePatch) {
    setProject((currentProject) => new UpdateElementFrameCommand(elementId, patch).execute(currentProject));
  }

  return {
    project,
    activePageId,
    selection,
    activeTab,
    setActiveTab,
    modelStates,
    downloadRequiredModels,
    selectElement,
    updateElementFrame,
  };
}
