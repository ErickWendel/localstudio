/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment */
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test('normalizes image grid prompt tasks and applies grid layout frames in the browser runtime', async ({
  page,
}) => {
  await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

  const result = await page.evaluate(async () => {
    const { slideLayoutPresets } = (await import(
      '/editor/src/services/prompting/slideLayoutPresets.ts'
    )) as typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets');

    const document = slideLayoutPresets.normalizeSlideTasksForLayout(
      {
        page: { id: 'page-grid', height: 1080, width: 1920 },
        tasks: [
          {
            id: 'title-grid',
            text: 'AI product gallery',
            type: 'add-title',
          },
        ],
      },
      'Create a three image grid with matching captions about web AI, black background, green title, white subtitle',
    );

    const imageTasks = document.tasks.filter((task) => task.type === 'add-placeholder-image');
    const captionTasks = document.tasks.filter((task) => task.type === 'add-body-text');
    const image = imageTasks[0]!;
    const laidOutImage = slideLayoutPresets.applySlideElementLayoutPreset(
      { height: 10, id: image.id, opacity: 1, rotation: 0, type: 'image', width: 10, x: 0, y: 0 },
      { allTasks: document.tasks, page: document.page, task: image },
    );
    const caption = captionTasks[0]!;
    const laidOutCaption = slideLayoutPresets.applySlideElementLayoutPreset(
      {
        align: 'left',
        fill: '#000000',
        fontFamily: 'Inter',
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
      captionFill: laidOutCaption.fill,
      captionX: laidOutCaption.x,
      imageCount: imageTasks.length,
      imageWidth: laidOutImage.width,
    };
  });

  expect(result).toEqual({
    captionFill: '#FFFFFF',
    captionX: 120,
    imageCount: 3,
    imageWidth: 500,
  });
});
