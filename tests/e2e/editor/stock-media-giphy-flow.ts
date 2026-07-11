import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const stockMediaGiphyFlow = {
  async searchCelebrationGif(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.openTool('Elements');
    await page.getByRole('textbox', { name: 'Search GIPHY GIFs' }).fill('celebration');
    await page.getByRole('button', { name: 'Search GIPHY GIFs submit' }).click();
    await expect(page.getByRole('button', { name: 'Insert GIF E2E celebration' })).toBeVisible();
  },
};
