import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { layoutPresetContractFixtures } from './layout-preset-contract-fixtures';

type LayoutPresetBulletContractResult = {
  bulletCount: number | undefined;
  bulletFrameWidth: number | undefined;
};

export const layoutPresetBulletContractPage = {
  async run(page: Page, baseURL: string): Promise<LayoutPresetBulletContractResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(async ({ pageSize, prompt }) => {
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
        {
          align: 'left',
          fill: '#000000',
          fontFamily: 'Open Sans',
          fontSize: 20,
          fontWeight: 400,
          height: 10,
          id: firstBulletTask.id,
          lineHeight: 1.1,
          opacity: 1,
          rotation: 0,
          text: firstBulletTask.items.join('\n'),
          type: 'text',
          width: 10,
          x: 0,
          y: 0,
        },
        { allTasks: document.tasks, page: document.page, task: firstBulletTask },
      );

      return {
        bulletCount: firstBulletTask.items.length,
        bulletFrameWidth: bulletText.width,
      };
    }, {
      pageSize: layoutPresetContractFixtures.pageSize,
      prompt: layoutPresetContractFixtures.bulletPrompt,
    });
  },
};
