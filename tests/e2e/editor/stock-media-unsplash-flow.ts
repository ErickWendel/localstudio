import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const stockMediaUnsplashFlow = {
  async insertDashboardImage(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.openTool('Elements');
    await page.getByRole('textbox', { name: 'Search Unsplash images' }).fill('dashboard');
    await page.getByRole('button', { name: 'Search Unsplash images submit' }).click();
    await expect(page.getByRole('button', { name: 'Insert image by E2E Photographer' })).toBeVisible();
    await page.getByRole('button', { name: 'Insert image by E2E Photographer' }).click();
    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'E2E stock dashboard', exact: true })).toBeVisible();
  },
};
