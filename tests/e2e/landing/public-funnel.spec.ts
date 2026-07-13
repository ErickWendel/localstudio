import { LandingAppPage } from '../pages/landing-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('landing public funnel journey', () => {
  test('navigates the public funnel into editor and WebMCP routes', async ({ page }) => {
    const landing = new LandingAppPage(page, getServer().baseURL);
    await landing.gotoHome();

    await expect(page.getByRole('navigation', { name: 'Landing sections' })).toBeVisible();
    await expect(
      page.locator('.landing-header').getByRole('link', { name: 'LocalStudio.dev beta home' }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Import existing presentations' }).click();
    await page.getByRole('tab', { name: 'Prompt-to-slide' }).click();
    await expect(page.getByText('A prompt becomes editable slide layers')).toBeVisible();

    await page.getByRole('link', { name: 'Features' }).click();
    await expect(page.getByRole('heading', { name: 'Every AI action returns to the editor.' })).toBeVisible();

    await expect(page.getByRole('link', { name: /Star LocalStudio.dev on GitHub/i })).toHaveAttribute(
      'href',
      /github\.com\/ErickWendel\/localstudio/,
    );

    await page.getByRole('link', { name: 'Open editor' }).first().click();
    await expect(page).toHaveURL(/\/editor\/$/);
    await expect(page.getByRole('heading', { name: 'LocalStudio.dev' })).toBeVisible();

    await page.goto(new URL('/', getServer().baseURL).toString());
    await page.getByRole('link', { name: 'Open WebMCP demo' }).click();
    await expect(page).toHaveURL(/\/editor\/webmcp$/);
    await expect(page.getByRole('heading', { name: /WebMCP showcase/i })).toBeVisible();
  });
});
