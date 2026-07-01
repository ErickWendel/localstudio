import { lazy, Suspense, useMemo } from 'react';
import { createAppServices } from './app/composition';
import { publicBasePath } from './app/routing/publicBasePath';
import { sampleProject } from './domain/projects/sampleProject';

const EditorShell = lazy(() =>
  import('./ui/editor/shell/EditorShell').then((module) => ({ default: module.EditorShell })),
);
const PublicDeckViewer = lazy(() =>
  import('./ui/share/PublicDeckViewer').then((module) => ({ default: module.PublicDeckViewer })),
);
const WebMcpShowcasePage = lazy(() =>
  import('./ui/webmcp/WebMcpShowcasePage').then((module) => ({
    default: module.WebMcpShowcasePage,
  })),
);

function normalizeRoutePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function App() {
  const pathname = normalizeRoutePath(window.location.pathname);
  const shareRoute = getShareRoute(window.location.pathname);
  if (shareRoute) {
    const services = createAppServices();
    return (
      <Suspense fallback={null}>
        <PublicDeckViewer
          shareId={shareRoute.shareId}
          shareService={services.shareService}
          embed={shareRoute.embed}
        />
      </Suspense>
    );
  }

  if (pathname === '/webmcp' || pathname === '/editor/webmcp') {
    return (
      <Suspense fallback={null}>
        <WebMcpShowcasePage />
      </Suspense>
    );
  }

  return <EditorApp />;
}

function getShareRoute(pathname: string) {
  const queryRoute = getShareQueryRoute();
  if (queryRoute) return queryRoute;

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

function getShareQueryRoute() {
  const url = new URL(window.location.href);
  const shareId = url.searchParams.get('share');
  if (shareId) {
    return {
      embed: false,
      shareId,
    };
  }

  const embedShareId = url.searchParams.get('embed');
  if (!embedShareId) return undefined;
  return {
    embed: true,
    shareId: embedShareId,
  };
}

function stripBasePath(pathname: string) {
  const basePath = publicBasePath.getPublicBasePath();
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
            initialProject: sampleProject.createBlankProject(),
            skipStoredProjectLoad: true,
          }
        : (() => {
            const storedProjectName = url.searchParams.get('project');
            return storedProjectName ? { storedProjectName } : {};
          })(),
    );
  }, []);

  return (
    <Suspense fallback={null}>
      <EditorShell services={services} />
    </Suspense>
  );
}
