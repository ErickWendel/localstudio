import { type Page } from '@playwright/test';

import { type EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { selectLayerAndExpectCanvasSelection } from './drag-reorder-layer-selection';

export async function reorderAnimationBuilds(editor: EditorAppPage, page: Page) {
  await editor.openTool('Layout');
  await expect(page.locator('.layer-list article[role="button"]')).toHaveCount(2);
  await selectLayerAndExpectCanvasSelection(page, 'Layer text', /text-/);
  await editor.openTool('Animate');
  await expect(page.getByRole('button', { name: 'Add animation' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add animation' }).click();
  await editor.openTool('Layout');
  await selectLayerAndExpectCanvasSelection(page, 'Background Shape', /shape-/);
  await editor.openTool('Animate');
  await expect(page.getByRole('button', { name: 'Add animation' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add animation' }).click();

  const buildRows = page
    .getByRole('list', { name: 'Object animation build order' })
    .getByRole('listitem');
  await expect(buildRows).toHaveCount(2);
  await expect(buildRows.nth(0)).toHaveAccessibleName(/Build 1: Layer text/);
  await expect(buildRows.nth(1)).toHaveAccessibleName(/Build 2: Rectangle/);
  await buildRows.nth(1).dragTo(buildRows.nth(0), {
    sourcePosition: { x: 30, y: 24 },
    targetPosition: { x: 30, y: 4 },
  });
  await expect(buildRows.nth(0)).toHaveAccessibleName(/Build 1: Rectangle/);
  await expect(buildRows.nth(1)).toHaveAccessibleName(/Build 2: Layer text/);
}
