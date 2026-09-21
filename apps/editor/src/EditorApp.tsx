import { useEffect, useMemo, useState } from 'react';
import { createAppServices } from './app/composition';
import type { ProjectDocument } from './domain/documents/model';
import { sampleProject } from './domain/projects/sampleProject';
import { EditorShell } from './ui/editor/shell/EditorShell';

function getInitialSrc(): string | null {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get('src');
}

export function EditorApp() {
  const [src] = useState(getInitialSrc);
  const [srcProject, setSrcProject] = useState<ProjectDocument | null>(null);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    if (!src) return;
    let isActive = true;
    void fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${src}: ${res.status}`);
        return res.json() as Promise<{ project?: ProjectDocument }>;
      })
      .then((data: { project?: ProjectDocument }) => {
        if (!isActive) return;
        const project = data.project ?? (data as unknown as ProjectDocument);
        setSrcProject(project);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('Failed to load project from src:', err);
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [src]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0f12',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <p>Loading presentation...</p>
      </div>
    );
  }

  if (srcProject) {
    return <EditorShellWithServices initialProject={srcProject} />;
  }

  return <EditorShellWithServices />;
}

function EditorShellWithServices({
  initialProject,
}: {
  initialProject?: ProjectDocument | undefined;
}) {
  const services = useMemo(() => {
    if (initialProject) {
      return createAppServices({
        initialProject,
        skipStoredProjectLoad: true,
      });
    }

    const url = new URL(window.location.href);
    const storedProjectName = url.searchParams.get('project');
    const shouldStartBlankProject =
      url.searchParams.get('newProject') === '1' || !storedProjectName;
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
  }, [initialProject]);

  return <EditorShell services={services} />;
}
