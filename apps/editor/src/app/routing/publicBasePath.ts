const DEFAULT_EDITOR_BASE_PATH = '/editor/';

function getPublicBasePath() {
  const viteBasePath = import.meta.env.BASE_URL;
  return normalizeBasePath(viteBasePath && viteBasePath !== '/' ? viteBasePath : DEFAULT_EDITOR_BASE_PATH);
}

function normalizeBasePath(basePath: string) {
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export const publicBasePath = {
  getPublicBasePath,
  normalizeBasePath,
};
