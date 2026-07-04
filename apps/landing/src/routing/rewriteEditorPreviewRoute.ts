export function rewriteEditorPreviewRoute(req: { url?: string | undefined }) {
  if (!req.url) return;
  const [pathname, query = ''] = req.url.split('?');
  if (pathname === '/editor' || pathname === '/joystick') {
    req.url = `${pathname}/${query ? `?${query}` : ''}`;
    return;
  }
  if (!pathname?.match(/^\/editor\/(s|embed)\/[^/]+\/?$/)) return;
  req.url = `/editor/${query ? `?${query}` : ''}`;
}
