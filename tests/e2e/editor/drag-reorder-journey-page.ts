import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

async function selectLayerAndExpectCanvasSelection(
  page: Page,
  layerName: string,
  expectedSelection: RegExp,
) {
  const layer = page.locator(`.layer-list article[role="button"][aria-label="${layerName}"]`);
  await expect(layer).toBeVisible();
  await expect.poll(async () => layer.count()).toBe(1);
  await layer.click();
  await expect(page.getByLabel('Slide canvas', { exact: true })).toHaveAttribute(
    'data-selected-elements',
    expectedSelection,
  );
}

export const dragReorderJourneyPage = {
  async reorderLayersSlidesAndAnimationBuilds(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Layer text');

    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add square' }).click();
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

    await editor.openPagesPanel();
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
    await pagesPanel.getByLabel('Add page').click();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Agenda');
    await page.getByLabel('Page 2 title').press('Enter');
    await pagesPanel.getByLabel('Add page').click();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 3' }).click();
    await page.getByLabel('Page 3 title').fill('Appendix');
    await page.getByLabel('Page 3 title').press('Enter');

    const pageCards = pagesPanel.locator('article.page-card');
    await expect(pageCards).toHaveCount(3);
    await pageCards.nth(2).dragTo(pageCards.nth(0), {
      sourcePosition: { x: 40, y: 40 },
      targetPosition: { x: 40, y: 5 },
    });
    await expect(pageCards.nth(0)).toHaveAttribute('aria-label', 'Page 1: Agenda');
    await expect(pageCards.nth(1)).toHaveAttribute('aria-label', 'Page 2: Slide 1');
    await expect(pageCards.nth(2)).toHaveAttribute('aria-label', 'Page 3: Appendix');

    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();
    await expect(page.getByText('2 / 3')).toBeVisible();
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
  },
};
