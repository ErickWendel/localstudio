export type LayoutPresetImageElementFixture = {
  height: number;
  id: string;
  opacity: number;
  rotation: number;
  type: 'image';
  width: number;
  x: number;
  y: number;
};

export type LayoutPresetTextElementFixture = {
  align: 'left';
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  height: number;
  id: string;
  lineHeight: number;
  opacity: number;
  rotation: number;
  text: string;
  type: 'text';
  width: number;
  x: number;
  y: number;
};

export const layoutPresetContractFixtures = {
  bulletPrompt:
    'Make a slide with 4 bullets about local browser AI with image on the left and right text block',
  createImageElement(id: string): LayoutPresetImageElementFixture {
    return {
      height: 10,
      id,
      opacity: 1,
      rotation: 0,
      type: 'image',
      width: 10,
      x: 0,
      y: 0,
    };
  },
  createTextElement(id: string, text: string, fontSize = 20): LayoutPresetTextElementFixture {
    return {
      align: 'left',
      fill: '#000000',
      fontFamily: 'Open Sans',
      fontSize,
      fontWeight: 400,
      height: 10,
      id,
      lineHeight: 1.1,
      opacity: 1,
      rotation: 0,
      text,
      type: 'text',
      width: 10,
      x: 0,
      y: 0,
    };
  },
  gridPrompt:
    'Create a three image grid with matching captions about web AI, black background, green title, white subtitle',
  pageSize: {
    height: 1080,
    width: 1920,
  },
  titlePrompt:
    'Title: Browser-native slides. Subtitle: Private local AI workflow. Use white background and cyan title.',
};
