/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { createCommandContractProject } from './command-contract-project';

const getServer = withIsolatedDevServer(test);

test.describe('editor animation and background command contracts', () => {
  test('executes page background, transition, and animation build commands in the browser runtime', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const result = await page.evaluate(async (initialProject) => {
      const { basicCommands } = (await import(
        '/editor/src/domain/commands/elements/basicCommands.ts'
      )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

      function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message);
      }

      let project = initialProject;
      const run = (command: { execute(project: typeof project): typeof project }) => {
        project = command.execute(project);
      };

      run(new basicCommands.UpdatePageBackgroundCommand('page-1', { color: '#101820', type: 'color' }));
      run(
        new basicCommands.SetPageTransitionCommand('page-1', {
          delayMs: -10,
          direction: 'left',
          durationMs: 500,
          effect: 'push',
          trigger: 'after-delay',
        }),
      );
      const transitionBeforeClear = project.pages[0]?.transition;
      run(new basicCommands.ClearPageTransitionCommand('page-1'));
      run(
        new basicCommands.SetElementAnimationBuildsCommand(
          'page-1',
          ['text-1', 'shape-1'],
          (elementId: string) => 'build-' + elementId,
          { delayMs: -20, direction: 'up', durationMs: 300, effect: 'fade', trigger: 'click' },
        ),
      );
      run(new basicCommands.ReorderElementAnimationBuildCommand('page-1', 'shape-1', 0));
      run(new basicCommands.ClearElementAnimationBuildCommand('page-1', 'text-1'));

      assert(project.pages[0]?.background.color === '#101820', 'background should be updated');
      assert(!project.pages[0]?.transition, 'transition should be cleared');
      assert(project.pages[0]?.animationBuilds?.[0]?.elementId === 'shape-1', 'animation should reorder');

      return {
        animationBuilds: project.pages[0]?.animationBuilds,
        background: project.pages[0]?.background,
        transitionBeforeClear,
      };
    }, createCommandContractProject());

    expect(result).toMatchObject({
      animationBuilds: [{ elementId: 'shape-1', id: 'build-shape-1' }],
      background: { color: '#101820', type: 'color' },
      transitionBeforeClear: { delayMs: 0, direction: 'left', durationMs: 500, effect: 'push' },
    });
  });
});
