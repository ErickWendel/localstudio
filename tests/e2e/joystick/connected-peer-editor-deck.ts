import type { Page } from '@playwright/test';
import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const connectedPeerEditorDeck = {
  async create(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.openPagesPanel();
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Close');
    await page.getByLabel('Page 2 title').press('Enter');
    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('3 / 3')).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 3' }).click();
    await page.getByLabel('Page 3 title').fill('Appendix');
    await page.getByLabel('Page 3 title').press('Enter');
    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();
    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await page
      .getByRole('textbox', { name: 'Speaker notes' })
      .fill('Use this space to capture presenter notes');
    await page.getByRole('button', { name: 'Close notes panel' }).click();
  },
};
