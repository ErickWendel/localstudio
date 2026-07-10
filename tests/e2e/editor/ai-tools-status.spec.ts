import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor AI tools status journey', () => {
  test('checks local AI status surfaces without downloading or executing models', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('AI Tools');
    await expect(page.getByLabel('AI feature setup')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download all|Ready/ })).toBeVisible();
    await expect(page.getByLabel('LLM Model', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Translation Model', { exact: true })).toBeVisible();
    await expect(page.getByText('Image Editing Models')).toBeVisible();
    await expect(page.getByText('Image Generation Models')).toBeVisible();
    await expect(page.getByLabel('Create image prompt')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Download|Prepare|Create image/ }).first(),
    ).toBeVisible();
  });
});
