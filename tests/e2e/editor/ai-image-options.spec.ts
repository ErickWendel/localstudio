import { EditorAppPage } from '../pages/editor-app.page';
import { installMockAiProviders } from '../support/mock-ai';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor AI image generation options journey', () => {
  test('prepares image generation, changes size, steps, and seed before generating an asset', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await installMockAiProviders(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('AI Tools');
    await page.getByRole('button', { name: 'Download Image Generation Models' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Image Generation Models' })).toBeVisible({
      timeout: 30_000,
    });

    const imageSize = page.getByRole('group', { name: 'Image size' });
    await imageSize.getByRole('button', { name: '16:9' }).click();
    await expect(imageSize.getByRole('button', { name: '16:9' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('slider', { name: /Steps/i }).fill('7');
    await expect(page.getByRole('slider', { name: /Steps/i })).toHaveValue('7');
    await page.getByLabel('Image seed').fill('12345');
    await expect(page.getByLabel('Image seed')).toHaveValue('12345');

    await page.getByLabel('Create image prompt').fill('seeded neon dashboard render');
    await expect(page.getByLabel('Create image prompt')).toHaveValue('seeded neon dashboard render');
    await page.getByRole('button', { name: 'Submit prompt' }).click();

    await editor.openTool('Assets');
    await expect(page.getByText(/\.png$/)).toBeVisible({ timeout: 30_000 });

    await editor.openTool('AI Tools');
    await page.getByRole('button', { name: 'Remove Image Generation Models' }).click();
    await expect(page.getByRole('button', { name: 'Download Image Generation Models' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('shows an image generation failure and lets the user retry successfully', async ({ page }) => {
    test.setTimeout(90_000);
    await installMockAiProviders(page, { bonsaiGenerateFailures: 1 });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('AI Tools');
    await page.getByRole('button', { name: 'Download Image Generation Models' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Image Generation Models' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel('Create image prompt').fill('retryable neon image');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await expect(
      page.getByRole('tooltip', { name: 'Mock Bonsai image generation failed.' }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('Create image prompt').fill('retryable neon image after failure');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await editor.openTool('Assets');
    await expect(page.getByText(/\.png$/)).toBeVisible({ timeout: 30_000 });
  });
});
