/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test('normalizes bullet prompt tasks and applies bullet layout frames in the browser runtime', async ({
  page,
}) => {
  await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

  const result = await page.evaluate(async () => {
    const { slideLayoutPresets } = (await import(
      '/editor/src/services/prompting/slideLayoutPresets.ts'
    )) as typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets');

    const document = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        page: { id: 'page-bullets', height: 1080, width: 1920 },
        tasks: [],
      },
      'Make a slide with 4 bullets about local browser AI with image on the left and right text block',
    );
    const bulletTasks = document.tasks.filter((task) => task.type === 'add-bullets');
    const bulletText = slideLayoutPresets.applySlideElementLayoutPreset(
      {
        align: 'left',
        fill: '#000000',
        fontFamily: 'Inter',
        fontSize: 20,
        fontWeight: 400,
        height: 10,
        id: bulletTasks[0]!.id,
        lineHeight: 1.1,
        opacity: 1,
        rotation: 0,
        text: bulletTasks[0]!.items.join('\\n'),
        type: 'text',
        width: 10,
        x: 0,
        y: 0,
      },
      { allTasks: document.tasks, page: document.page, task: bulletTasks[0]! },
    );

    return {
      bulletCount: bulletTasks[0]?.items.length,
      bulletFrameWidth: bulletText.width,
    };
  });

  expect(result).toEqual({
    bulletCount: 3,
    bulletFrameWidth: 1200,
  });
});
