import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const aiGemmaProviderActions = {
  async remove(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.openTool('AI Tools');
    await page.getByRole('button', { name: 'Remove Translation Model' }).click();
    await expect(page.getByRole('button', { name: 'Download Translation Model' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Remove Language Detection Model' }).click();
    await expect(page.getByRole('button', { name: 'Download Language Detection Model' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Remove LLM Model' }).click();
    await expect(page.getByRole('button', { name: 'Download LLM Model' })).toBeVisible({
      timeout: 30_000,
    });
  },
};
