import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const aiTranslationActions = {
  async translateGeneratedTitle(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.openTool('AI Tools');
    await page.getByLabel('Translate to').selectOption('pt');
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'AI workflow validated', exact: true }).click();
    await page.getByRole('button', { name: 'Translate Selected Text' }).click();
    await expect(page.getByRole('button', { name: '[pt] AI workflow validated', exact: true })).toBeVisible({
      timeout: 30_000,
    });
  },
};
