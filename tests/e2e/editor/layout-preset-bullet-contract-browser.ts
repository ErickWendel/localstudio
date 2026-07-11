import { type LayoutPresetTextElementFixture } from './layout-preset-contract-fixtures';

export type LayoutPresetBulletContractResult = {
  bulletCount: number | undefined;
  bulletFrameWidth: number | undefined;
};

type LayoutPresetBulletContractInput = {
  pageSize: { height: number; width: number };
  prompt: string;
  textElement: LayoutPresetTextElementFixture;
};

export async function evaluateLayoutPresetBulletContract({
  pageSize,
  prompt,
  textElement,
}: LayoutPresetBulletContractInput): Promise<LayoutPresetBulletContractResult> {
  const { slideLayoutPresets } = (await import(
    '/editor/src/services/prompting/slideLayoutPresets.ts'
  )) as typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets');

  const document = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      page: { id: 'page-bullets', ...pageSize },
      tasks: [],
    },
    prompt,
  );
  const firstBulletTask = document.tasks.find((task) => task.type === 'add-bullets');
  if (!firstBulletTask) {
    return {
      bulletCount: undefined,
      bulletFrameWidth: undefined,
    };
  }

  const bulletText = slideLayoutPresets.applySlideElementLayoutPreset(
    { ...textElement, id: firstBulletTask.id, text: firstBulletTask.items.join('\n') },
    { allTasks: document.tasks, page: document.page, task: firstBulletTask },
  );

  return {
    bulletCount: firstBulletTask.items.length,
    bulletFrameWidth: bulletText.width,
  };
}
