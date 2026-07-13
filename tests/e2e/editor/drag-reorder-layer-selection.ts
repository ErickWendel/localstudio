import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function selectLayerAndExpectCanvasSelection(
  page: Page,
  layerName: string,
  expectedSelection: RegExp,
) {
  const layer = page.locator(`.layer-list article[role="button"][aria-label="${layerName}"]`);
  await expect(layer).toBeVisible();
  await expect.poll(async () => layer.count()).toBe(1);
  await expect(async () => {
    await layer.click();
    await expect(page.getByLabel('Slide canvas', { exact: true })).toHaveAttribute(
      'data-selected-elements',
      expectedSelection,
      { timeout: 1_000 },
    );
  }).toPass();
}
