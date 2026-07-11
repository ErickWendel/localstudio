import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { installMockAiProviders } from '../support/mock-ai';
import { aiTranslationActions } from './ai-translation-actions';

export const aiBrowserProvidersFlow = {
  async run(page: Page, baseURL: string): Promise<void> {
    await installMockAiProviders(page);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await editor.openTool('AI Tools');
    await page.getByRole('button', { name: 'Download Image Generation Models' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Image Generation Models' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel('Create image prompt').fill('neon product dashboard');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await editor.openTool('Assets');
    await expect(page.getByText('neon product dashboard.png')).toBeVisible({ timeout: 30_000 });

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove Create image mode' })).toBeEnabled();
    await page.getByRole('button', { name: 'Remove Create image mode' }).click();
    await page
      .getByRole('textbox', { name: 'Slide structure prompt' })
      .fill('Create a title and subtitle slide about browser AI QA');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await expect(page.getByRole('button', { name: 'AI workflow validated', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Generated through mocked browser AI', exact: true })).toBeVisible();

    await aiTranslationActions.translateGeneratedTitle(editor, page);
  },
};
