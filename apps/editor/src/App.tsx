import { lazy, Suspense, useEffect, useState } from 'react';
import { publicBasePath } from './app/routing/publicBasePath';
import { EditorMobileUnavailable } from './ui/editor/shell/EditorMobileUnavailable';

const EditorApp = lazy(() => import('./EditorApp').then((module) => ({ default: module.EditorApp })));
const PublicDeckApp = lazy(() =>
  import('./PublicDeckApp').then((module) => ({ default: module.PublicDeckApp })),
);
const PresenterView = lazy(() =>
  import('./ui/presenter/PresenterView').then((module) => ({ default: module.PresenterView })),
);
const WebMcpShowcasePage = lazy(() =>
  import('./ui/webmcp/WebMcpShowcasePage').then((module) => ({
    default: module.WebMcpShowcasePage,
  })),
);

function normalizeRoutePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

const editorMobileViewportQuery = '(max-width: 760px)';

function isMobileEditorViewport() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (isWebMcpEnabled()) return false;
  return window.matchMedia(editorMobileViewportQuery).matches;
}

export function App() {
  const pathname = normalizeRoutePath(window.location.pathname);
  const presenterSessionId = getPresenterSessionId();
  if (presenterSessionId) {
    return (
      <Suspense fallback={null}>
        <PresenterView sessionId={presenterSessionId} />
      </Suspense>
    );
  }

  const shareRoute = getShareRoute(window.location.pathname);
  if (shareRoute) {
    return (
      <Suspense fallback={null}>
        <PublicDeckApp embed={shareRoute.embed} shareId={shareRoute.shareId} />
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

  return <EditorRoute />;
}

function getPresenterSessionId() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('presenter') !== '1') return undefined;
  return url.searchParams.get('presenterSession') ?? undefined;
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

function isWebMcpEnabled() {
  return new URL(window.location.href).searchParams.get('webmcp') === '1';
}

function EditorRoute() {
  const [mobileEditorUnavailable, setMobileEditorUnavailable] = useState(isMobileEditorViewport);

  useEffect(() => {
    if (isWebMcpEnabled()) return undefined;
    if (!window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia(editorMobileViewportQuery);
    function syncMobileEditorAvailability(event: MediaQueryList | MediaQueryListEvent) {
      setMobileEditorUnavailable(event.matches);
    }

    syncMobileEditorAvailability(mediaQuery);
    mediaQuery.addEventListener('change', syncMobileEditorAvailability);
    return () => {
      mediaQuery.removeEventListener('change', syncMobileEditorAvailability);
    };
  }, []);

  if (mobileEditorUnavailable) {
    return <EditorMobileUnavailable />;
  }

  return (
    <Suspense fallback={null}>
      <EditorApp />
    </Suspense>
  );
}
