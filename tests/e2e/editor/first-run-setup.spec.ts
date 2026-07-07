import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor first-run setup journey', () => {
  test('blocks entry until required local browser capabilities are available', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('localstudio.ai.setup-complete');
      Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined });
      Object.defineProperty(globalThis, 'showDirectoryPicker', { configurable: true, value: undefined });
      Object.defineProperty(window, 'Translator', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'storage', { configurable: true, value: {} });
    });

    await page.goto(`${getServer().baseURL}/editor/?newProject=1`);

    await expect(
      page.getByRole('heading', { name: 'LocalStudio.dev runs locally in this browser.' }),
    ).toBeVisible();
    await expect(page.getByText('Project Files', { exact: true })).toBeVisible();
    await expect(page.getByText('Local AI Providers', { exact: true })).toBeVisible();
    await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Continue to editor' })).toBeDisabled();

    await page.getByRole('button', { name: 'Check again' }).click();
    await expect(page.getByRole('button', { name: 'Continue to editor' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'LocalStudio.dev', exact: true })).toBeHidden();
  });

  test('continues to the editor when local storage and AI providers are ready', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('localstudio.ai.setup-complete');
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => {
          await Promise.resolve();
          return {};
        },
      });
      Object.defineProperty(window, 'Translator', {
        configurable: true,
        value: {
          availability: async () => {
            await Promise.resolve();
            return 'available';
          },
        },
      });
    });

    await page.goto(`${getServer().baseURL}/editor/?newProject=1`);

    await expect(
      page.getByRole('heading', { name: 'LocalStudio.dev runs locally in this browser.' }),
    ).toBeVisible();
    await expect(page.getByText('Ready', { exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Continue to editor' }).click();
    await expect(page.getByRole('heading', { name: 'LocalStudio.dev' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('localstudio.ai.setup-complete')))
      .toBe('true');
  });
});
