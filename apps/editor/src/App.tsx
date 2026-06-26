import { useMemo } from 'react';
import { createAppServices } from './app/composition';
import { createBlankProject } from './domain/sampleProject';
import { EditorShell } from './ui/editor/EditorShell';

export function App() {
  const services = useMemo(() => {
    const url = new URL(window.location.href);
    const shouldStartBlankProject = url.searchParams.get('newProject') === '1';
    if (shouldStartBlankProject) {
      url.searchParams.delete('newProject');
      url.searchParams.delete('project');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    return createAppServices(
      shouldStartBlankProject
        ? {
            initialProject: createBlankProject(),
            skipStoredProjectLoad: true,
          }
        : (() => {
            const storedProjectName = url.searchParams.get('project');
            return storedProjectName ? { storedProjectName } : {};
          })(),
    );
  }, []);

  return <EditorShell services={services} />;
}
