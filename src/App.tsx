import { useMemo } from 'react';
import { createAppServices } from './app/composition';
import { createBlankProject } from './domain/sampleProject';
import { EditorShell } from './ui/editor/EditorShell';

export function App() {
  const services = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const shouldStartBlankProject = searchParams.get('newProject') === '1';

    return createAppServices(
      shouldStartBlankProject
        ? {
            initialProject: createBlankProject(),
            skipStoredProjectLoad: true,
          }
        : undefined,
    );
  }, []);

  return <EditorShell services={services} />;
}
