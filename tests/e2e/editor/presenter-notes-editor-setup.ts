import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const presenterNotesEditorSetup = {
  async addAndPersistSpeakerNotes(editor: EditorAppPage, page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await expect(page.getByRole('region', { name: 'Speaker notes editor' })).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Speaker notes' })
      .fill('Remember to pause after the opening slide.');
    await page.getByRole('button', { name: 'Close notes panel' }).click();
    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await expect(page.getByRole('textbox', { name: 'Speaker notes' })).toHaveValue(
      'Remember to pause after the opening slide.',
    );
    await editor.openPagesPanel();
  },

  async addPresenterCloseSlide(page: Page): Promise<void> {
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Presenter Close');
    await page.getByLabel('Page 2 title').press('Enter');
    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();
  },
};
