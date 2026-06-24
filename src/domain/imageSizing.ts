interface FitImageWithinPageInput {
  imageWidth: number;
  imageHeight: number;
  pageWidth: number;
  pageHeight: number;
}

export function fitImageWithinPage({
  imageWidth,
  imageHeight,
  pageWidth,
  pageHeight,
}: FitImageWithinPageInput) {
  const scale = Math.min(1, pageWidth / imageWidth, pageHeight / imageHeight);
  const width = Math.round(imageWidth * scale);
  const height = Math.round(imageHeight * scale);

  return {
    x: Math.round((pageWidth - width) / 2),
    y: Math.round((pageHeight - height) / 2),
    width,
    height,
  };
}
