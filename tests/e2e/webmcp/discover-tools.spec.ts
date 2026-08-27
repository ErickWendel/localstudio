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
    ).toBeVisible();
    await page.getByRole('button', { name: 'Discover tools' }).click();
    await expect(page.getByText(/Discovered \d+ tools/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'create_presentation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'import_powerpoint_from_disk' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Create presentation' }).click();
    await expect(page.getByLabel('Create presentation command input')).toBeVisible();
    await page.getByLabel('Create presentation command input').fill('E2E WebMCP project');
    await page.getByRole('button', { name: 'Send Create presentation' }).click();
    await expect(page.getByText('Create presentation completed.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last WebMCP result' })).toContainText(
      'E2E WebMCP project',
    );

    await page.getByRole('button', { name: 'Upsert slide' }).click();
    await expect(page.getByLabel('Upsert slide command input')).toBeVisible();
    await page.getByRole('button', { name: 'Send Upsert slide' }).click();
    await expect(page.getByText('Upsert slide completed.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last WebMCP result' })).toContainText(
      'idempotentReplay',
    );
    await expect(
      page
        .frameLocator('iframe[title="LocalStudio editor WebMCP demo"]')
        .getByText(/Page 1.*Agent-native presentations/),
    ).toBeVisible();

    await page.getByRole('button', { name: 'get_presentation_state' }).click();
    await page.getByRole('button', { name: 'Read presentation state' }).click();
    await expect(page.getByText('Read presentation state completed.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last WebMCP result' })).toContainText(
      'E2E WebMCP project',
    );
    await expect(page.getByRole('region', { name: 'Last WebMCP result' })).toContainText(
      'Presentations become agent-native',
    );
  });
});
