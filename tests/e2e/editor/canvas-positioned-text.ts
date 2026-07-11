import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

type CanvasTextPosition = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export const canvasPositionedText = {
  async add(editor: EditorAppPage, page: Page, name: string, position: CanvasTextPosition): Promise<void> {
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
  },
};
