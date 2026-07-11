import {
  type LayoutPresetImageElementFixture,
  type LayoutPresetTextElementFixture,
} from './layout-preset-contract-fixtures';

export type LayoutPresetGridContractResult = {
  captionFill: string | undefined;
  captionX: number | undefined;
  imageCount: number;
  imageWidth: number | undefined;
};

type LayoutPresetGridContractInput = {
  imageElement: LayoutPresetImageElementFixture;
  pageSize: { height: number; width: number };
  prompt: string;
  textElement: LayoutPresetTextElementFixture;
};

export async function evaluateLayoutPresetGridContract({
  imageElement,
  pageSize,
  prompt,
  textElement,
}: LayoutPresetGridContractInput): Promise<LayoutPresetGridContractResult> {
  const { slideLayoutPresets } = (await import(
    '/editor/src/services/prompting/slideLayoutPresets.ts'
  )) as typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets');

  const document = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      page: { id: 'page-grid', ...pageSize },
      tasks: [{ id: 'title-grid', text: 'AI product gallery', type: 'add-title' }],
    },
    prompt,
  );

  const imageTasks = document.tasks.filter((task) => task.type === 'add-placeholder-image');
  const captionTasks = document.tasks.filter((task) => task.type === 'add-body-text');
  const image = imageTasks[0];
  const caption = captionTasks[0];
  if (!image || !caption) {
    return {
      captionFill: undefined,
      captionX: undefined,
      imageCount: imageTasks.length,
      imageWidth: undefined,
    };
  }

  const laidOutImage = slideLayoutPresets.applySlideElementLayoutPreset(
    { ...imageElement, id: image.id },
    { allTasks: document.tasks, page: document.page, task: image },
  );
  const laidOutCaption = slideLayoutPresets.applySlideElementLayoutPreset(
    { ...textElement, id: caption.id, text: caption.text },
    { allTasks: document.tasks, page: document.page, task: caption },
  );

  return {
    captionFill: laidOutCaption.type === 'text' ? laidOutCaption.fill : undefined,
    captionX: laidOutCaption.x,
    imageCount: imageTasks.length,
    imageWidth: laidOutImage.width,
  };
}
