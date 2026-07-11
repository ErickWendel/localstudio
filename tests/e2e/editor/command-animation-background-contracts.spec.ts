import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { evaluateCommandAnimationBackgroundContract } from './command-animation-background-contract-browser';
import { createCommandContractProject } from './command-contract-project';

const getServer = withIsolatedDevServer(test);

test.describe('editor animation and background command contracts', () => {
  test('executes page background, transition, and animation build commands in the browser runtime', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const result = await page.evaluate(
      evaluateCommandAnimationBackgroundContract,
      createCommandContractProject(),
    );

    expect(result).toMatchObject({
      animationBuilds: [{ elementId: 'shape-1', id: 'build-shape-1' }],
      background: { color: '#101820', type: 'color' },
      transitionBeforeClear: { delayMs: 0, direction: 'left', durationMs: 500, effect: 'push' },
    });
  });
});
