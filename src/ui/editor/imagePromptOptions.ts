export interface CreateImagePromptOptions {
  height: number;
  seed?: number;
  steps: number;
  width: number;
}

export const imageSizePresets: Array<{ label: string; width: number; height: number }> = [
  { label: '1:1', width: 512, height: 512 },
  { label: '4:3', width: 640, height: 480 },
  { label: '3:4', width: 480, height: 640 },
  { label: '16:9', width: 768, height: 432 },
  { label: '9:16', width: 432, height: 768 },
];

export const defaultCreateImagePromptOptions: CreateImagePromptOptions = {
  width: 512,
  height: 512,
  steps: 4,
};

export function getImageSizeLabel(options: Pick<CreateImagePromptOptions, 'height' | 'width'>) {
  return imageSizePresets.find((preset) => preset.width === options.width && preset.height === options.height)?.label ?? 'Custom';
}
