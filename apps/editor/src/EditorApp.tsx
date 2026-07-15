import { useMemo } from 'react';
import { createAppServices } from './app/composition';
import { sampleProject } from './domain/projects/sampleProject';
import { EditorShell } from './ui/editor/shell/EditorShell';

export function EditorApp() {
  const services = useMemo(() => {
    const url = new URL(window.location.href);
    const storedProjectName = url.searchParams.get('project');
    const shouldStartBlankProject =
      url.searchParams.get('newProject') === '1' || !storedProjectName;
    if (shouldStartBlankProject) {
      url.searchParams.delete('newProject');
      url.searchParams.delete('project');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    return createAppServices(
      shouldStartBlankProject
        ? {
            initialProject: sampleProject.createBlankProject(),
            skipStoredProjectLoad: true,
          }
        : { storedProjectName },
    );
  }, []);

  return <EditorShell services={services} />;
}
