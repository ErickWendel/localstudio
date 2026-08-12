export function createTrustedPresenterPreviewImageUrl(label: string, backgroundColor: string) {
  const encodedSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320"><rect width="180" height="320" fill="${backgroundColor}"/><text x="12" y="34" fill="white" font-size="18">Top</text><text x="12" y="166" fill="white" font-size="22">${label}</text><text x="12" y="304" fill="white" font-size="18">Bottom</text></svg>`,
  );
  return `data:image/svg+xml,${encodedSvg}`;
}
