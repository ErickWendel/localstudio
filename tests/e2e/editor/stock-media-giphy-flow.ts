import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const stockMediaGiphyFlow = {
  async searchCelebrationGif(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.openTool('Elements');
    await page.getByRole('textbox', { name: 'Search GIPHY GIFs' }).fill('celebration');
    await page.getByRole('button', { name: 'Search GIPHY GIFs submit' }).click();
    const gifResult = page.getByRole('button', { name: 'Insert GIF E2E celebration' });
    await expect(gifResult).toBeVisible();
    await gifResult.click();
    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'E2E celebration', exact: true })).toBeVisible();
    await editor.openTool('Elements');
    await expect(
      page.getByRole('region', { name: 'Recently used results' }).getByRole('button', {
        name: 'Insert GIF E2E celebration',
      }),
    ).toBeVisible();
  },
};
