import { type Page } from '@playwright/test';

import { type EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export async function reorderSlides(editor: EditorAppPage, page: Page) {
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
}
