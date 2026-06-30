import { useMemo } from 'react';
import { createAppServices } from './app/composition';
import { getPublicBasePath } from './app/publicBasePath';
import { createBlankProject } from './domain/sampleProject';
import { EditorShell } from './ui/editor/EditorShell';
import { PublicDeckViewer } from './ui/share/PublicDeckViewer';
import { WebMcpShowcasePage } from './ui/webmcp/WebMcpShowcasePage';

export function App() {
  const shareRoute = getShareRoute(window.location.pathname);
  if (shareRoute) {
    const services = createAppServices();
    return (
      <PublicDeckViewer
        shareId={shareRoute.shareId}
        shareService={services.shareService}
        embed={shareRoute.embed}
      />
    );
  }

  if (window.location.pathname === '/webmcp' || window.location.pathname === '/editor/webmcp') {
    return <WebMcpShowcasePage />;
  }

  return <EditorApp />;
}

function getShareRoute(pathname: string) {
  const routePathname = stripBasePath(pathname);
  const match = routePathname.match(/^\/(s|embed)\/([^/]+)$/);
  if (!match) return undefined;
  const shareId = match[2];
  if (!shareId) return undefined;
  return {
    embed: match[1] === 'embed',
    shareId: decodeURIComponent(shareId),
  };
}

function stripBasePath(pathname: string) {
  const basePath = getPublicBasePath();
  if (basePath === '/') return pathname;

  if (!pathname.startsWith(basePath)) return pathname;

  return `/${pathname.slice(basePath.length)}`;
}

function EditorApp() {
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
