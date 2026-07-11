export const presenterProtocolPreviewFixture = {
  createPreview() {
    const textElement = {
      align: 'center',
      fill: '#ffffff',
      fontFamily: 'Inter',
      fontSize: 40,
      fontWeight: 700,
      height: 120,
      id: 'text',
      kind: 'text',
      opacity: 1,
      rotation: 0,
      text: 'Hello',
      width: 400,
      x: 0,
      y: 0,
    };
    const mediaElement = {
      assetUrl: 'blob:video',
      autoplay: true,
      controls: true,
      height: 180,
      id: 'media',
      kind: 'media',
      loop: false,
      mediaType: 'video',
      muted: true,
      opacity: 1,
      rotation: 0,
      width: 320,
      x: 10,
      y: 10,
    };
    const shapeElement = {
      fill: '#111111',
      height: 100,
      id: 'shape',
      kind: 'shape',
      opacity: 1,
      rotation: 0,
      shape: 'rectangle',
      stroke: '#ffffff',
      strokeWidth: 2,
      width: 100,
      x: 20,
      y: 20,
    };

    return {
      backgroundColor: '#000000',
      backgroundImageUrl: 'blob:bg',
      elements: [textElement, mediaElement, shapeElement],
      height: 1080,
      width: 1920,
    };
  },
};
