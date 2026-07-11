/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test('normalizes title prompt tasks and applies centered title frames in the browser runtime', async ({
  page,
}) => {
  await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

  const result = await page.evaluate(async () => {
    const { slideLayoutPresets } = (await import(
      '/editor/src/services/prompting/slideLayoutPresets.ts'
    )) as typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets');

    const document = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        page: { id: 'page-title', height: 1080, width: 1920 },
        tasks: [],
      },
      'Title: Browser-native slides. Subtitle: Private local AI workflow. Use white background and cyan title.',
    );
    const titleTask = document.tasks.find((task) => task.type === 'add-title')!;
    const subtitleTask = document.tasks.find((task) => task.type === 'add-subtitle')!;
    const titleElement = slideLayoutPresets.applySlideElementLayoutPreset(
      {
        align: 'left',
        fill: '#000000',
        fontFamily: 'Inter',
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
        fontFamily: 'Inter',
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
      subtitleText: subtitleElement.text,
      titleFill: titleElement.fill,
      titleText: titleElement.text,
    };
  });

  expect(result).toEqual({
    subtitleText: '',
    titleFill: '#22D3EE',
    titleText: undefined,
  });
});
