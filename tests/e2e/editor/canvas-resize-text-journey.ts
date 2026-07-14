import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { getCanvasPoint } from './canvas-design-point';

export async function resizeTextAndUseArrangeControls(page: Page, baseURL: string) {
  const editor = new EditorAppPage(page, baseURL);
  await editor.gotoNewProject();

  await editor.openTool('Text');
  await page.getByRole('button', { name: 'Add a text box' }).click();
  await editor.openTool('Design');
  await expect(page.getByRole('region', { name: 'Selected text controls' })).toBeVisible();
  await page
    .getByRole('tablist', { name: 'Movie inspector sections' })
    .getByRole('tab', { name: 'Arrange' })
    .click();

  const widthInput = page.getByLabel('Selected element width');
  const heightInput = page.getByLabel('Selected element height');
  const xInput = page.getByLabel('Selected element x position');
  const yInput = page.getByLabel('Selected element y position');
  const textFontSizeInput = page.getByRole('spinbutton', { name: 'Text font size' });
  const rotationInput = page.getByRole('spinbutton', { name: 'Selected element rotation' });
  await xInput.fill('560');
  await yInput.fill('280');
  await widthInput.fill('320');
  await heightInput.fill('180');

  const initialTextFontSize = Number(await textFontSizeInput.inputValue());
  const verticalHandleProbe = await getCanvasPoint(page, { x: 720, y: 460 });
  await page.mouse.move(verticalHandleProbe.x, verticalHandleProbe.y);
  await page.mouse.down();
  await page.mouse.move(verticalHandleProbe.x, verticalHandleProbe.y + 45, { steps: 10 });
  await page.mouse.up();

  await expect(textFontSizeInput).toHaveValue(String(initialTextFontSize));
  await expect(widthInput).toHaveValue('320');
  await expect(heightInput).toHaveValue('180');

  const frameX = Number(await xInput.inputValue());
  const frameY = Number(await yInput.inputValue());
  const frameWidth = Number(await widthInput.inputValue());
  const frameHeight = Number(await heightInput.inputValue());
  const resizeStart = await getCanvasPoint(page, {
    x: frameX + frameWidth,
    y: frameY + frameHeight,
  });
  await page.mouse.move(resizeStart.x, resizeStart.y);
  await page.mouse.down();
  await page.mouse.move(resizeStart.x + 90, resizeStart.y + 50, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => Number(await widthInput.inputValue())).toBeGreaterThan(frameWidth);
  await expect.poll(async () => Number(await heightInput.inputValue())).toBeGreaterThan(frameHeight);

  await editor.openTool('Text');
  await page.getByRole('button', { name: 'Add a text box' }).click();
  await editor.openTool('Design');
  await page
    .getByRole('tablist', { name: 'Movie inspector sections' })
    .getByRole('tab', { name: 'Arrange' })
    .click();
  await xInput.fill('560');
  await yInput.fill('280');
  await widthInput.fill('320');
  await heightInput.fill('120');

  const editPoint = await getCanvasPoint(page, { x: 720, y: 340 });
  await page.mouse.dblclick(editPoint.x, editPoint.y);
  const canvasTextEditor = page.getByRole('textbox', { name: 'Edit text' });
  await expect(canvasTextEditor).toBeVisible();
  await canvasTextEditor.fill('Hello dear');
  await expect.poll(async () => Number(await heightInput.inputValue())).toBeLessThan(120);
  await canvasTextEditor.fill(
    '55 Horas, 770M Tokens e Uma Alternativa ao Canva Rodando no Browser',
  );
  await expect.poll(async () => Number(await heightInput.inputValue())).toBeGreaterThan(120);
  await expect(canvasTextEditor).toBeFocused();
  await page.keyboard.press('Enter');

  await rotationInput.fill('18');
  await expect(rotationInput).toHaveValue('18');
}
