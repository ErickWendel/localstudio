import { useEffect, useState } from 'react';
import type { ProjectDocument } from '../../../domain/documents/model';

export interface RemoteProjectState {
  project: ProjectDocument | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Loads a remote presentation project from a specified URL source.
 * Handles request lifecycle, cancellation via AbortController, and response parsing.
 */
export function useRemoteProject(src: string | null): RemoteProjectState {
  const [prevSrc, setPrevSrc] = useState(src);
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(src));
  const [error, setError] = useState<Error | null>(null);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setIsLoading(Boolean(src));
    setProject(null);
    setError(null);
  }

  useEffect(() => {
    if (!src) return;

    const targetUrl = src;
    const controller = new AbortController();

    async function fetchProject() {
      try {
        const response = await fetch(targetUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load presentation from ${targetUrl}: HTTP ${response.status}`);
        }

        const payload = (await response.json()) as
          | { project?: ProjectDocument }
          | ProjectDocument;

        const resolvedProject =
          'project' in payload && payload.project ? payload.project : (payload as ProjectDocument);

        setProject(resolvedProject);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        console.error('Failed to load project from src:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchProject();

    return () => {
      controller.abort();
    };
  }, [src]);

  return { project, isLoading, error };
}
