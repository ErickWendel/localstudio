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
    const inlineTextEditor = page.getByRole('textbox', { name: 'Edit text' });
    await expect(inlineTextEditor).toBeFocused();
    await expect(inlineTextEditor).toHaveValue('Add a little bit of body text');
    await page.keyboard.type('Overwritten body copy');
    await expect(inlineTextEditor).toHaveValue('Overwritten body copy');
    await inlineTextEditor.evaluate((element) => {
      const input = element as HTMLTextAreaElement;
      input.setSelectionRange(12, 16);
      input.dispatchEvent(new Event('select', { bubbles: true }));
    });
    const textColorInput = page.getByRole('toolbar', { name: 'Text editing controls' }).getByLabel('Text color');
    await textColorInput.fill('#ff0055');
    await expect(textColorInput).toHaveValue('#ff0055');
    await page.keyboard.press('Enter');

    const toolbar = page.getByRole('toolbar', { name: 'Text editing controls' });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('spinbutton', { name: 'Text font size' }).fill('48');
    await toolbar.getByRole('button', { name: 'Bold text' }).click();
    await toolbar.getByRole('button', { name: 'Text alignment menu' }).click();
    await toolbar.getByRole('button', { name: 'Align text right' }).click();
    await toolbar.getByRole('button', { name: 'Text alignment menu' }).click();
    await toolbar.getByRole('button', { name: 'Align text bottom' }).click();
    await toolbar.getByRole('button', { name: 'Edit text hyperlink' }).click();
    await toolbar.getByRole('textbox', { name: 'Text hyperlink URL' }).fill('localstudio.dev');
    await toolbar.getByRole('button', { name: 'Apply' }).click();
    await toolbar.getByLabel('Text color').fill('#00779a');
    await expect(toolbar.getByRole('button', { name: 'Bold text' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(toolbar.getByRole('button', { name: 'Edit text hyperlink' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await toolbar.getByRole('button', { name: 'Text alignment menu' }).click();
    await expect(toolbar.getByRole('button', { name: 'Align text right' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(toolbar.getByRole('button', { name: 'Align text bottom' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await editor.openTool('Design');
    await expect(page.getByLabel('Selected text font size')).toHaveValue('48');
    await expect(page.getByLabel('Selected text color')).toHaveValue('#00779a');
    await page.getByLabel('Selected text font', { exact: true }).click();
    await page.getByRole('button', { name: 'Apply Orbitron' }).click();
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Arrange' })
      .click();
    await expect.poll(async () => Number(await page.getByLabel('Selected element height').inputValue()))
      .toBeLessThan(120);
    await expect(page.getByRole('button', { name: 'Group', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ungroup' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Distribute' })).toBeDisabled();
  });

  test('applies sticky toolbar formatting across multiple selected text elements', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    const inlineTextEditor = page.getByRole('textbox', { name: 'Edit text' });
    await expect(inlineTextEditor).toBeFocused();
    await page.keyboard.type('First multi text');
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'Add a text box' }).click();
    await expect(inlineTextEditor).toBeFocused();
    await page.keyboard.type('Second multi text');
    await page.keyboard.press('Enter');

    await editor.openTool('Layout');
    const firstLayer = page.locator('.layer-list article[role="button"][aria-label="First multi text"]');
    const secondLayer = page.locator('.layer-list article[role="button"][aria-label="Second multi text"]');
    await secondLayer.click();
    await firstLayer.click({ modifiers: ['Shift'] });
    await expect(firstLayer).toHaveAttribute('aria-pressed', 'true');
    await expect(secondLayer).toHaveAttribute('aria-pressed', 'true');

    const toolbar = page.getByRole('toolbar', { name: 'Text editing controls' });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('spinbutton', { name: 'Text font size' }).fill('64');
    await toolbar.getByRole('button', { name: 'Bold text' }).click();
    await toolbar.getByRole('button', { name: 'Text alignment menu' }).click();
    await toolbar.getByRole('button', { name: 'Align text center' }).click();
    await toolbar.getByRole('button', { name: 'Text alignment menu' }).click();
    await toolbar.getByRole('button', { name: 'Align text middle' }).click();
    await toolbar.getByRole('button', { name: 'Text alignment menu' }).click();
    await expect(toolbar.getByRole('button', { name: 'Align text middle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await firstLayer.click();
    await editor.openTool('Design');
    await expect(page.getByLabel('Selected text font size')).toHaveValue('64');
    await expect(page.getByRole('button', { name: 'Align selected text center' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Align selected text middle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await editor.openTool('Layout');
    await secondLayer.click();
    await editor.openTool('Design');
    await expect(page.getByLabel('Selected text font size')).toHaveValue('64');
    await expect(page.getByRole('button', { name: 'Align selected text center' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Align selected text middle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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
