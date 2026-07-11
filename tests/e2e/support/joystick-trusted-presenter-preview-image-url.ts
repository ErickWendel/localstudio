export function createTrustedPresenterPreviewImageUrl(label: string, backgroundColor: string) {
  const encodedSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${backgroundColor}"/><text x="28" y="96" fill="white" font-size="28">${label}</text></svg>`,
  );
  return `data:image/svg+xml,${encodedSvg}`;
}
