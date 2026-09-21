import { useMemo, useState } from 'react';
import { createAppServices } from './app/composition';
import type { ProjectDocument } from './domain/documents/model';
import { sampleProject } from './domain/projects/sampleProject';
import { useRemoteProject } from './ui/editor/hooks/useRemoteProject';
import { EditorLoadingScreen } from './ui/editor/shell/EditorLoadingScreen';
import { EditorShell } from './ui/editor/shell/EditorShell';

function getInitialSrc(): string | null {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get('src');
}

function resolveAppServices(initialProject?: ProjectDocument) {
  if (initialProject) {
    return createAppServices({
      initialProject,
      skipStoredProjectLoad: true,
    });
  }

  const url = new URL(window.location.href);
  const storedProjectName = url.searchParams.get('project');
  const shouldStartBlankProject = url.searchParams.get('newProject') === '1' || !storedProjectName;

  if (shouldStartBlankProject) {
    url.searchParams.delete('newProject');
    url.searchParams.delete('project');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  return createAppServices(
    shouldStartBlankProject
      ? {
          initialProject: sampleProject.createBlankProject(),
          skipStoredProjectLoad: true,
        }
      : storedProjectName
        ? { storedProjectName }
        : {},
  );
}

export function EditorApp() {
  const [src] = useState(getInitialSrc);
  const { project, isLoading } = useRemoteProject(src);

  if (isLoading) {
    return <EditorLoadingScreen />;
  }

  return <EditorShellWithServices initialProject={project ?? undefined} />;
}

function EditorShellWithServices({
  initialProject,
}: {
  initialProject?: ProjectDocument | undefined;
}) {
  const services = useMemo(() => resolveAppServices(initialProject), [initialProject]);

  return <EditorShell services={services} />;
}
