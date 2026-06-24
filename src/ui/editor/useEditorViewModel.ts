import { useEffect, useMemo, useState } from 'react';
import type { AppServices } from '../../app/composition';
import type { ProjectDocument, SelectionState } from '../../domain/model';
import type { ModelState } from '../../services/interfaces';

export type RightPanelTab = 'design' | 'layers' | 'ai-tools';

export function useEditorViewModel(services: AppServices) {
  const [project] = useState<ProjectDocument>(services.initialProject);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('ai-tools');
  const [modelStates, setModelStates] = useState<ModelState[]>([]);
  const activePageId = project.pages[0]?.id ?? '';
  const selection = useMemo<SelectionState>(
    () => ({ pageId: activePageId, elementIds: ['image-hero'] }),
    [activePageId],
  );

  useEffect(() => {
    void services.modelSetupService.getModelStates().then(setModelStates);
  }, [services.modelSetupService]);

  return { project, activePageId, selection, activeTab, setActiveTab, modelStates };
}
