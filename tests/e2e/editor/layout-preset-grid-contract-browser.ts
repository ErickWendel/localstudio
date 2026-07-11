export type LayoutPresetGridContractResult = {
  captionFill: string | undefined;
  captionX: number | undefined;
  imageCount: number;
  imageWidth: number | undefined;
};

type LayoutPresetGridContractInput = {
  pageSize: { height: number; width: number };
  prompt: string;
};

export async function evaluateLayoutPresetGridContract({
  pageSize,
  prompt,
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
    { height: 10, id: image.id, opacity: 1, rotation: 0, type: 'image', width: 10, x: 0, y: 0 },
    { allTasks: document.tasks, page: document.page, task: image },
  );
  const laidOutCaption = slideLayoutPresets.applySlideElementLayoutPreset(
    {
      align: 'left',
      fill: '#000000',
      fontFamily: 'Open Sans',
      fontSize: 18,
      fontWeight: 400,
      height: 10,
      id: caption.id,
      lineHeight: 1.1,
      opacity: 1,
      rotation: 0,
      text: caption.text,
      type: 'text',
      width: 10,
      x: 0,
      y: 0,
    },
    { allTasks: document.tasks, page: document.page, task: caption },
  );

  return {
    captionFill: laidOutCaption.type === 'text' ? laidOutCaption.fill : undefined,
    captionX: laidOutCaption.x,
    imageCount: imageTasks.length,
    imageWidth: laidOutImage.width,
  };
}
