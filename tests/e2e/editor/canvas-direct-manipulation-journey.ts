import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const canvasDirectManipulationJourney = {
  async runElementDrag(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
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
    const canvasBox = await getCanvasBox(page);
    const scaleX = canvasBox.width / 1920;
    const scaleY = canvasBox.height / 1080;
    const startClientX = canvasBox.x + (startX + startWidth / 2) * scaleX;
    const startClientY = canvasBox.y + (startY + startHeight / 2) * scaleY;

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
  },

  async runMarqueeSelection(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await addPositionedText(editor, page, 'Marquee first', { height: 100, width: 320, x: 520, y: 320 });
    await addPositionedText(editor, page, 'Marquee second', { height: 100, width: 320, x: 900, y: 420 });

    const frame = page.getByTestId('slide-canvas-frame');
    const canvasBox = await getCanvasBox(page);
    const scaleX = canvasBox.width / 1920;
    const scaleY = canvasBox.height / 1080;
    const startClientX = canvasBox.x + 1260 * scaleX;
    const startClientY = canvasBox.y + 560 * scaleY;
    const endClientX = canvasBox.x + 480 * scaleX;
    const endClientY = canvasBox.y + 280 * scaleY;

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
  },
};

async function addPositionedText(
  editor: EditorAppPage,
  page: Page,
  name: string,
  position: { height: number; width: number; x: number; y: number },
): Promise<void> {
  const leftTextTool = page.getByLabel('Tool menu').getByRole('tab', { name: 'Text' });
  await leftTextTool.click();
  await expect(leftTextTool).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Add a text box' }).click();
  await editor.openTool('Design');
  await page
    .getByRole('tablist', { name: 'Movie inspector sections' })
    .getByRole('tab', { name: 'Text' })
    .click();
  await page.getByRole('textbox', { name: 'Selected text content' }).fill(name);
  await page.getByRole('tab', { name: 'Arrange' }).click();
  await page.getByLabel('Selected element x position').fill(String(position.x));
  await page.getByLabel('Selected element y position').fill(String(position.y));
  await page.getByLabel('Selected element width').fill(String(position.width));
  await page.getByLabel('Selected element height').fill(String(position.height));
}

async function getCanvasBox(page: Page) {
  const canvasBox = await page.getByTestId('slide-canvas-frame').locator('canvas').first().boundingBox();
  expect(canvasBox).not.toBeNull();
  return canvasBox!;
}
