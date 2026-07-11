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
  const rotationInput = page.getByRole('spinbutton', { name: 'Selected element rotation' });
  await xInput.fill('560');
  await yInput.fill('280');
  await widthInput.fill('320');
  await heightInput.fill('180');

  const resizeStart = await getCanvasPoint(page, { x: 880, y: 460 });
  await page.mouse.move(resizeStart.x, resizeStart.y);
  await page.mouse.down();
  await page.mouse.move(resizeStart.x + 90, resizeStart.y + 50, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => Number(await widthInput.inputValue())).toBeGreaterThan(360);
  await expect.poll(async () => Number(await heightInput.inputValue())).toBeGreaterThan(200);

  await editor.openTool('Layout');
  await page.getByRole('button', { name: 'Add a little bit of body text', exact: true }).click();
  await editor.openTool('Design');
  await page
    .getByRole('tablist', { name: 'Movie inspector sections' })
    .getByRole('tab', { name: 'Arrange' })
    .click();

  await rotationInput.fill('18');
  await expect(rotationInput).toHaveValue('18');
}
