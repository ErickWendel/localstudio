import { WebMcpPage } from '../pages/webmcp.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('WebMCP discover tools journey', () => {
  test('discovers tools and inspects the workflow without running AI actions', async ({ page }) => {
    const webmcp = new WebMcpPage(page, getServer().baseURL);
    await webmcp.gotoShowcase();

    await expect(page.getByRole('region', { name: 'WebMCP control plane' })).toBeVisible();
    await expect(page.getByLabel('Discovered tools')).toContainText('No tools discovered');
    await expect(
      page
        .frameLocator('iframe[title="LocalStudio editor WebMCP demo"]')
        .getByRole('heading', { name: 'LocalStudio.dev' }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Discover tools' }).click();
    await expect(page.getByText(/Discovered \d+ tools/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'create_project' })).toBeVisible();
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByLabel('Create project command input')).toBeVisible();
    await page.getByLabel('Create project command input').fill('E2E WebMCP project');
    await page.getByRole('button', { name: 'Send Create project' }).click();
    await expect(page.getByText('Create project completed.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last WebMCP result' })).toContainText(
      'E2E WebMCP project',
    );

    await page.getByRole('button', { name: 'get_project_snapshot' }).click();
    await page.getByRole('button', { name: 'Read snapshot' }).click();
    await expect(page.getByText('Read snapshot completed.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last WebMCP result' })).toContainText(
      'E2E WebMCP project',
    );
  });
});
