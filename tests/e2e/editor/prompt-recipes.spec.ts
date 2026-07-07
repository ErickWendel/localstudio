import { EditorAppPage } from '../pages/editor-app.page';
import { installMockAiProviders } from '../support/mock-ai';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor prompt recipe journey with mocked browser AI providers', () => {
  test('uses prompt example chips to switch from image ideas to generated slide content', async ({
    page,
  }) => {
    await installMockAiProviders(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page
      .getByRole('button', {
        name: /A realistic photo of a person using an AI-powered web app on a tablet/i,
      })
      .click();
    await expect(page.getByLabel('Create image prompt')).toHaveValue(
      /A realistic photo of a person using an AI-powered web app on a tablet/i,
    );

    await page.getByRole('button', { name: 'Remove Create image mode' }).click();
    await page
      .getByRole('button', { name: 'Top title and three body bullets about why Web AI is useful.' })
      .click();
    await expect(page.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue(
      'Top title and three body bullets about why Web AI is useful.',
    );
    await page.getByRole('button', { name: 'Submit prompt' }).click();

    await expect(page.getByText('Page 1 - AI generated slide')).toBeVisible({
      timeout: 30_000,
    });
    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'AI workflow validated', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Generated through mocked browser AI', exact: true }),
    ).toBeVisible();
  });
});
