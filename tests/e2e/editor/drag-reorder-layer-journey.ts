import { type Page } from '@playwright/test';

import { type EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export async function reorderCanvasLayers(editor: EditorAppPage, page: Page) {
  await editor.openTool('Layout');

  const layerRows = page.locator('.layer-list article[role="button"]');
  await expect(layerRows).toHaveCount(2);
  await expect(layerRows.nth(0)).toHaveAttribute('aria-label', 'Background Shape');
  await expect(layerRows.nth(1)).toHaveAttribute('aria-label', 'Layer text');
  await layerRows.nth(1).dragTo(layerRows.nth(0), {
    sourcePosition: { x: 20, y: 20 },
    targetPosition: { x: 20, y: 4 },
  });
  await expect(layerRows.nth(0)).toHaveAttribute('aria-label', 'Layer text');
  await expect(layerRows.nth(1)).toHaveAttribute('aria-label', 'Background Shape');
}
