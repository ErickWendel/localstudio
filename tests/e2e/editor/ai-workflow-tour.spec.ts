import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

const tourStepTitles = [
  'Open AI Tools',
  'Prepare the AI runtime',
  'Create images from the prompt bar',
  'Use the prompt recipes',
  'Switch back to slide prompts',
  'Generate or stop from here',
  'Open the File menu',
  'Choose Import',
  'Bring in an existing deck',
  'Enable local storage',
  'Configure S3-compatible mirroring',
  'Test, enable, and save',
  'Open media integrations',
  'Connect stock media',
  'Paste provider keys',
  'Save the media setup',
];

test.describe('editor AI workflow tour journey', () => {
  test('launches from Help and walks through AI setup, import, storage, mirror, and media steps', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('localstudio.ai-workflow-tour.enabled', '1');
      window.localStorage.setItem('localstudio.ai-workflow-tour.seen', '1');
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await editor.openMenu('Help');
      const tourItem = page.getByRole('menuitem', { name: 'AI Setup Tour' });
      const clicked = await tourItem
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (clicked) break;
      if (attempt === 2) throw new Error('AI Setup Tour menu item could not be clicked.');
    }

    for (const [index, title] of tourStepTitles.entries()) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      const buttonName = index === tourStepTitles.length - 1 ? 'Done' : 'Next';
      await page.getByRole('button', { name: buttonName }).click();
    }

    await expect(page.getByText(tourStepTitles.at(-1)!, { exact: true })).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem('localstudio.ai-workflow-tour.seen')),
      )
      .toBe('1');
    await expect(page.getByRole('dialog', { name: 'Media integrations' })).toBeHidden();
  });
});
