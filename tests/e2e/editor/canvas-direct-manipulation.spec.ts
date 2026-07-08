import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor canvas direct manipulation journey', () => {
  test('selects multiple slide elements with a marquee drag', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const leftTextTool = page.getByLabel('Tool menu').getByRole('tab', { name: 'Text' });
    await leftTextTool.click();
    await expect(leftTextTool).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Marquee first');
    await page.getByRole('tab', { name: 'Arrange' }).click();
    await page.getByLabel('Selected element x position').fill('520');
    await page.getByLabel('Selected element y position').fill('320');
    await page.getByLabel('Selected element width').fill('320');
    await page.getByLabel('Selected element height').fill('100');

    await leftTextTool.click();
    await expect(leftTextTool).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Marquee second');
    await page.getByRole('tab', { name: 'Arrange' }).click();
    await page.getByLabel('Selected element x position').fill('900');
    await page.getByLabel('Selected element y position').fill('420');
    await page.getByLabel('Selected element width').fill('320');
    await page.getByLabel('Selected element height').fill('100');

    const frame = page.getByTestId('slide-canvas-frame');
    const canvas = frame.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const scaleX = canvasBox!.width / 1920;
    const scaleY = canvasBox!.height / 1080;
    const startClientX = canvasBox!.x + 1260 * scaleX;
    const startClientY = canvasBox!.y + 560 * scaleY;
    const endClientX = canvasBox!.x + 480 * scaleX;
    const endClientY = canvasBox!.y + 280 * scaleY;

    await page.mouse.move(startClientX, startClientY);
    await page.mouse.down();
    await page.mouse.move(endClientX, endClientY, { steps: 8 });
    await expect(frame).toHaveAttribute('data-marquee-selection', 'active');
    const marqueeBox = await page.getByTestId('marquee-selection-box').boundingBox();
    expect(marqueeBox).not.toBeNull();
    expect(Math.abs(marqueeBox!.x - endClientX)).toBeLessThan(3);
    expect(Math.abs(marqueeBox!.y - endClientY)).toBeLessThan(3);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const selectedElements = (await frame.getAttribute('data-selected-elements')) ?? '';
        return selectedElements.split(',').filter(Boolean).length;
      })
      .toBe(2);
  });

  test('drags a selected canvas element and verifies transform controls stay in sync', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page.getByRole('tab', { name: 'Arrange' }).click();

    const xInput = page.getByLabel('Selected element x position');
    const yInput = page.getByLabel('Selected element y position');
    const widthInput = page.getByLabel('Selected element width');
    const heightInput = page.getByLabel('Selected element height');
    const rotationInput = page.getByRole('spinbutton', { name: 'Selected element rotation' });
    const startX = Number(await xInput.inputValue());
    const startY = Number(await yInput.inputValue());
    const startWidth = Number(await widthInput.inputValue());
    const startHeight = Number(await heightInput.inputValue());

    const frame = page.getByTestId('slide-canvas-frame');
    const canvas = frame.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    const scaleX = canvasBox!.width / 1920;
    const scaleY = canvasBox!.height / 1080;
    const startClientX = canvasBox!.x + (startX + startWidth / 2) * scaleX;
    const startClientY = canvasBox!.y + (startY + startHeight / 2) * scaleY;

    await page.mouse.move(startClientX, startClientY);
    await page.mouse.down();
    await page.mouse.move(startClientX + 120, startClientY + 72, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => Number(await xInput.inputValue())).toBeGreaterThan(startX + 50);
    await expect.poll(async () => Number(await yInput.inputValue())).toBeGreaterThan(startY + 30);
    await expect(frame).toHaveAttribute('data-selected-elements', /text-/);

    await widthInput.fill('640');
    await heightInput.fill('180');
    await rotationInput.fill('15');
    await expect(widthInput).toHaveValue('640');
    await expect(heightInput).toHaveValue('180');
    await expect(rotationInput).toHaveValue('15');
  });
});
