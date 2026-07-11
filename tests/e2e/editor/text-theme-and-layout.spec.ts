import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor text theme and layout journey', () => {
  test('edits text from the floating toolbar and verifies disabled grouping affordances', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Add a little bit of body text', exact: true }).click();

    const toolbar = page.getByRole('toolbar', { name: 'Text editing controls' });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('spinbutton', { name: 'Text font size' }).fill('48');
    await toolbar.getByRole('button', { name: 'Bold text' }).click();
    await toolbar.getByRole('button', { name: 'Align text right' }).click();
    await toolbar.getByLabel('Text color').fill('#00779a');
    await expect(toolbar.getByRole('button', { name: 'Bold text' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(toolbar.getByRole('button', { name: 'Align text right' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await editor.openTool('Design');
    await expect(page.getByLabel('Selected text font size')).toHaveValue('48');
    await expect(page.getByLabel('Selected text color')).toHaveValue('#00779a');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Arrange' })
      .click();
    await expect(page.getByRole('button', { name: 'Group', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ungroup' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Distribute' })).toBeDisabled();
  });

  test('changes presentation and slide design surfaces without selecting an element', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Design');
    await expect(
      page.getByRole('button', { name: 'Open theme picker, current theme Default theme' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open theme picker, current theme Default theme' }).click();
    const themeChooser = page.getByRole('region', { name: 'Choose a theme' });
    await expect(themeChooser).toBeVisible();
    await expect(themeChooser.getByText('Default theme')).toBeVisible();
    await themeChooser.getByRole('button').first().click();
    await expect(page.getByRole('button', { name: 'Apply theme' })).toBeEnabled();
    await page.getByRole('button', { name: 'Apply theme' }).click();
    await page.getByLabel('Presentation type').selectOption('kiosk');
    await expect(page.getByLabel('Presentation type')).toHaveValue('kiosk');

    const frame = page.getByTestId('slide-canvas-frame');
    const canvas = frame.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.click(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2);
    await expect(page.getByRole('button', { name: 'Open layout picker, current layout Blank' })).toBeVisible();
    await page.getByRole('button', { name: 'Open layout picker, current layout Blank' }).click();
    await expect(page.getByRole('region', { name: 'Choose a layout' })).toBeVisible();
    await expect(page.getByText('No imported layouts yet.')).toBeVisible();
    await page.getByLabel('Slide background color').fill('#ffffff');
    await expect(page.getByLabel('Slide background color')).toHaveValue('#ffffff');
    await expect(page.getByLabel('Slide fill type')).toHaveValue('color');
    await expect(page.getByRole('button', { name: 'Apply layout' })).toBeDisabled();
  });
});
