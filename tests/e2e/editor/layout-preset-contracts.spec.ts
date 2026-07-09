/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment */
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor slide layout preset contracts', () => {
  test('normalizes prompt-driven slide tasks and applies layout frames in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(async () => {
      const { slideLayoutPresets } = (await import(
        '/editor/src/services/prompting/slideLayoutPresets.ts'
      )) as typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets');

      const gridDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
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

      const gridImageTasks = gridDocument.tasks.filter(
        (task) => task.type === 'add-placeholder-image',
      );
      const gridCaptionTasks = gridDocument.tasks.filter((task) => task.type === 'add-body-text');
      const gridImage = gridImageTasks[0]!;
      const laidOutGridImage = slideLayoutPresets.applySlideElementLayoutPreset(
        { height: 10, id: gridImage.id, opacity: 1, rotation: 0, type: 'image', width: 10, x: 0, y: 0 },
        { allTasks: gridDocument.tasks, page: gridDocument.page, task: gridImage },
      );
      const gridCaption = gridCaptionTasks[0]!;
      const laidOutGridCaption = slideLayoutPresets.applySlideElementLayoutPreset(
        {
          align: 'left',
          fill: '#000000',
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: 400,
          height: 10,
          id: gridCaption.id,
          lineHeight: 1.1,
          opacity: 1,
          rotation: 0,
          text: gridCaption.text,
          type: 'text',
          width: 10,
          x: 0,
          y: 0,
        },
        { allTasks: gridDocument.tasks, page: gridDocument.page, task: gridCaption },
      );

      const bulletDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
        {
          page: { id: 'page-bullets', height: 1080, width: 1920 },
          tasks: [],
        },
        'Make a slide with 4 bullets about local browser AI with image on the left and right text block',
      );
      const bulletTasks = bulletDocument.tasks.filter((task) => task.type === 'add-bullets');
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
        { allTasks: bulletDocument.tasks, page: bulletDocument.page, task: bulletTasks[0]! },
      );

      const titleDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
        {
          page: { id: 'page-title', height: 1080, width: 1920 },
          tasks: [],
        },
        'Title: Browser-native slides. Subtitle: Private local AI workflow. Use white background and cyan title.',
      );
      const titleTask = titleDocument.tasks.find((task) => task.type === 'add-title')!;
      const subtitleTask = titleDocument.tasks.find((task) => task.type === 'add-subtitle')!;
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
        { allTasks: titleDocument.tasks, page: titleDocument.page, task: titleTask },
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
        { allTasks: titleDocument.tasks, page: titleDocument.page, task: subtitleTask },
      );

      return {
        bulletCount: bulletTasks[0]?.items.length,
        bulletFrameWidth: bulletText.width,
        gridCaptionFill: laidOutGridCaption.fill,
        gridCaptionX: laidOutGridCaption.x,
        gridImageCount: gridImageTasks.length,
        gridImageWidth: laidOutGridImage.width,
        subtitleText: subtitleElement.text,
        titleFill: titleElement.fill,
        titleText: titleElement.text,
      };
    });

    expect(result).toEqual({
      bulletCount: 3,
      bulletFrameWidth: 1200,
      gridCaptionFill: '#FFFFFF',
      gridCaptionX: 120,
      gridImageCount: 3,
      gridImageWidth: 500,
      subtitleText: '',
      titleFill: '#22D3EE',
      titleText: undefined,
    });
  });
});
