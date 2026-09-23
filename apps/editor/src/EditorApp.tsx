import { useMemo } from 'react';
import { createAppServices } from './app/composition';
import { sampleProject } from './domain/projects/sampleProject';
import { createE2eAssetFixtureProject } from './ui/e2e/createE2eAssetFixtureProject';
import { EditorShell } from './ui/editor/shell/EditorShell';

export function EditorApp() {
  const services = useMemo(() => {
    const url = new URL(window.location.href);
    const storedProjectName = url.searchParams.get('project');
    const shouldStartBlankProject =
      url.searchParams.get('newProject') === '1' || !storedProjectName;
    const useAssetFixtures = url.searchParams.get('e2eAssetFixtures') === '1';
    if (shouldStartBlankProject || useAssetFixtures) {
      url.searchParams.delete('newProject');
      url.searchParams.delete('project');
      url.searchParams.delete('e2eAssetFixtures');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    return createAppServices(
      shouldStartBlankProject || useAssetFixtures
        ? {
            initialProject: useAssetFixtures
              ? createE2eAssetFixtureProject()
              : sampleProject.createBlankProject(),
            skipStoredProjectLoad: true,
          }
        : { storedProjectName },
    );
  }, []);

  return <EditorShell services={services} />;
}
