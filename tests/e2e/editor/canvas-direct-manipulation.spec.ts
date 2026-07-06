import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor canvas direct manipulation journey', () => {
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
