import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const presenterNotesEditorSetup = {
  async addAndPersistSpeakerNotes(editor: EditorAppPage, page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await expect(page.getByRole('region', { name: 'Speaker notes editor' })).toBeVisible();
    const widthResizer = page.getByRole('separator', { name: 'Resize speaker notes width' });
    const notesWidthBefore = await widthResizer.getAttribute('aria-valuenow');
    const widthResizerBox = await widthResizer.boundingBox();
    if (!widthResizerBox) throw new Error('Speaker notes width resize handle should be visible');
    await page.mouse.move(
      widthResizerBox.x + widthResizerBox.width / 2,
      widthResizerBox.y + widthResizerBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      widthResizerBox.x + widthResizerBox.width / 2 + 120,
      widthResizerBox.y + widthResizerBox.height / 2,
    );
    await page.mouse.up();
    await expect(widthResizer).not.toHaveAttribute('aria-valuenow', notesWidthBefore ?? '');

    const heightResizer = page.getByRole('separator', { name: 'Resize speaker notes height' });
    const notesHeightBefore = await heightResizer.getAttribute('aria-valuenow');
    const heightResizerBox = await heightResizer.boundingBox();
    if (!heightResizerBox) throw new Error('Speaker notes height resize handle should be visible');
    await page.mouse.move(
      heightResizerBox.x + heightResizerBox.width / 2,
      heightResizerBox.y + heightResizerBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      heightResizerBox.x + heightResizerBox.width / 2,
      heightResizerBox.y + heightResizerBox.height / 2 + 120,
    );
    await page.mouse.up();
    await expect(heightResizer).not.toHaveAttribute('aria-valuenow', notesHeightBefore ?? '');
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
