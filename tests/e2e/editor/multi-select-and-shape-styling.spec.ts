import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor multi-select and advanced shape styling journeys', () => {
  test('multi-selects layers and verifies grouping affordances remain disabled until implemented', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page.getByRole('tablist', { name: 'Movie inspector sections' }).getByRole('tab', { name: 'Text' }).click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Multi-select text');

    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add square' }).click();
    await editor.openTool('Layout');

    const textLayer = page.locator('.layer-list article[role="button"][aria-label="Multi-select text"]');
    const shapeLayer = page.locator('.layer-list article[role="button"][aria-label="Background Shape"]');
    await shapeLayer.click();
    await textLayer.click({ modifiers: ['Shift'] });
    await expect(shapeLayer).toHaveAttribute('aria-pressed', 'true');
    await expect(textLayer).toHaveAttribute('aria-pressed', 'true');

    await editor.openTool('Design');
    await page.getByRole('tab', { name: 'Arrange' }).click();
    await expect(page.getByRole('button', { name: 'Group', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ungroup' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Distribute' })).toBeDisabled();
  });

  test('edits shape fill, border, opacity, line endpoints, and arrange controls', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add arrow' }).click();
    await editor.openTool('Design');

    await expect(page.getByRole('region', { name: 'Selected shape controls' })).toBeVisible();
    await page.getByLabel('Selected shape fill mode').selectOption('color');
    await page.getByLabel('Selected shape fill color').fill('#00779a');
    await expect(page.getByLabel('Selected shape fill color')).toHaveValue('#00779a');
    await page.getByLabel('Selected shape border mode').selectOption('color');
    await page.getByLabel('Selected shape border color').fill('#37fd76');
    await page.getByLabel('Selected shape border width').fill('12');
    await page.getByLabel('Selected shape start endpoint').selectOption('circle');
    await page.getByLabel('Selected shape end endpoint').selectOption('arrow');
    await page.getByLabel('Selected element opacity').fill('65');
    await expect(page.getByLabel('Selected shape border color')).toHaveValue('#37fd76');
    await expect(page.getByLabel('Selected shape border width')).toHaveValue('12');
    await expect(page.getByLabel('Selected shape start endpoint')).toHaveValue('circle');
    await expect(page.getByLabel('Selected shape end endpoint')).toHaveValue('arrow');

    await page.getByRole('tab', { name: 'Arrange' }).click();
    await page.getByLabel('Selected element width').fill('720');
    await page.getByLabel('Selected element height').fill('160');
    await page.getByRole('spinbutton', { name: 'Selected element rotation' }).fill('30');
    await page.getByLabel('Align selected element').selectOption('page-center');
    await expect(page.getByLabel('Selected element width')).toHaveValue('720');
    await expect(page.getByLabel('Selected element height')).toHaveValue('160');
    await expect(page.getByRole('spinbutton', { name: 'Selected element rotation' })).toHaveValue('30');
  });
});
