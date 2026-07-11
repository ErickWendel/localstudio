import { type LayoutPresetTextElementFixture } from './layout-preset-contract-fixtures';

export type LayoutPresetTitleContractResult = {
  subtitleText: string | undefined;
  titleFill: string | undefined;
  titleText: string | undefined;
};

type LayoutPresetTitleContractInput = {
  baseSubtitleElement: LayoutPresetTextElementFixture;
  baseTitleElement: LayoutPresetTextElementFixture;
  pageSize: { height: number; width: number };
  prompt: string;
};

export async function evaluateLayoutPresetTitleContract({
  baseSubtitleElement,
  baseTitleElement,
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
    { ...baseTitleElement, id: titleTask.id, text: titleTask.text },
    { allTasks: document.tasks, page: document.page, task: titleTask },
  );
  const subtitleElement = slideLayoutPresets.applySlideElementLayoutPreset(
    { ...baseSubtitleElement, id: subtitleTask.id, text: subtitleTask.text },
    { allTasks: document.tasks, page: document.page, task: subtitleTask },
  );

  return {
    subtitleText: subtitleElement.type === 'text' ? subtitleElement.text : undefined,
    titleFill: titleElement.type === 'text' ? titleElement.fill : undefined,
    titleText: titleElement.type === 'text' ? titleElement.text : undefined,
  };
}
