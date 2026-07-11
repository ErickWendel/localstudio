export function isCoverageImplementedSourcePath(normalized: string) {
  return (
    normalized.startsWith('apps/') ||
    normalized.startsWith('packages/') ||
    normalized.startsWith('src/') ||
    normalized.includes('/apps/') ||
    normalized.includes('/packages/') ||
    normalized.includes('/src/')
  );
}
