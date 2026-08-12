import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { canvasTransformerPoint } from './canvas-transformer-point';

export const canvasElementDragFlow = {
  async run(page: Page, baseURL: string): Promise<void> {
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
    const frame = page.getByTestId('slide-canvas-frame');
    const dragStart = await canvasTransformerPoint.get(page, 'center');

    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x + 120, dragStart.y + 72, { steps: 8 });
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
};
