export type LayoutPresetTitleContractResult = {
  subtitleText: string | undefined;
  titleFill: string | undefined;
  titleText: string | undefined;
};

type LayoutPresetTitleContractInput = {
  pageSize: { height: number; width: number };
  prompt: string;
};

export async function evaluateLayoutPresetTitleContract({
  pageSize,
  prompt,
}: LayoutPresetTitleContractInput): Promise<LayoutPresetTitleContractResult> {
  const { slideLayoutPresets } = (await import(
    '/editor/src/services/prompting/slideLayoutPresets.ts'
  )) as typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets');

  const document = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      page: { id: 'page-title', ...pageSize },
      tasks: [],
    },
    prompt,
  );
  const titleTask = document.tasks.find((task) => task.type === 'add-title');
  const subtitleTask = document.tasks.find((task) => task.type === 'add-subtitle');
  if (!titleTask || !subtitleTask) {
    return {
      subtitleText: undefined,
      titleFill: undefined,
      titleText: undefined,
    };
  }

  const titleElement = slideLayoutPresets.applySlideElementLayoutPreset(
    {
      align: 'left',
      fill: '#000000',
      fontFamily: 'Open Sans',
      fontSize: 20,
      fontWeight: 400,
      height: 10,
      id: titleTask.id,
      lineHeight: 1.1,
      opacity: 1,
      rotation: 0,
      text: titleTask.text,
      type: 'text',
      width: 10,
      x: 0,
      y: 0,
    },
    { allTasks: document.tasks, page: document.page, task: titleTask },
  );
  const subtitleElement = slideLayoutPresets.applySlideElementLayoutPreset(
    {
      align: 'left',
      fill: '#000000',
      fontFamily: 'Open Sans',
      fontSize: 20,
      fontWeight: 400,
      height: 10,
      id: subtitleTask.id,
      lineHeight: 1.1,
      opacity: 1,
      rotation: 0,
      text: subtitleTask.text,
      type: 'text',
      width: 10,
      x: 0,
      y: 0,
    },
    { allTasks: document.tasks, page: document.page, task: subtitleTask },
  );

  return {
    subtitleText: subtitleElement.type === 'text' ? subtitleElement.text : undefined,
    titleFill: titleElement.type === 'text' ? titleElement.fill : undefined,
    titleText: titleElement.type === 'text' ? titleElement.text : undefined,
  };
}
