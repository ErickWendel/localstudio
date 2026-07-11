export function normalizeCoverageSourcePath(
  sourcePath: string,
  info?: {
    distFile?: string;
  },
): string {
  const source = sourcePath.includes('/') ? sourcePath : (info?.distFile ?? sourcePath);
  let normalized = source.replaceAll('\\', '/').split('?')[0] ?? '';
  normalized = normalized.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1):\d+\//, '');
  normalized = normalized.replace(/^localhost-\d+\//, '');
  normalized = normalized.replace(/^@fs\//, '');
  const workspaceMarker = '/canva-webai-clone/';
  const workspaceIndex = normalized.indexOf(workspaceMarker);
  if (workspaceIndex >= 0) {
    normalized = normalized.slice(workspaceIndex + workspaceMarker.length);
  }
  normalized = normalized.replace(/^\/+/, '');

  if (normalized.startsWith('editor/src/')) return `apps/${normalized}`;
  if (normalized.startsWith('joystick/src/')) return `apps/${normalized}`;
  if (normalized.startsWith('landing/src/')) return `apps/${normalized}`;
  return normalized;
}
