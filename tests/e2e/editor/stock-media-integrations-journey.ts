import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { stockMediaGiphyFlow } from './stock-media-giphy-flow';
import { stockMediaRoutes } from './stock-media-routes';
import { stockMediaSettings } from './stock-media-settings';
import { stockMediaUnsplashFlow } from './stock-media-unsplash-flow';

export const stockMediaIntegrationsJourney = {
  async run(page: Page, baseURL: string): Promise<void> {
    await stockMediaRoutes.install(page);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await stockMediaSettings.configure(page);
    await stockMediaUnsplashFlow.insertDashboardImage(editor, page);
    await stockMediaGiphyFlow.searchCelebrationGif(editor, page);
    await stockMediaUnsplashFlow.replacePlaceholderWithDashboardImage(editor, page);
    await stockMediaGiphyFlow.replacePlaceholderWithCelebrationGif(editor, page);
    await stockMediaSettings.clear(page);
    await editor.openTool('Elements');
    await expect(page.getByText('Unsplash is not configured.')).toBeVisible();
    await expect(page.getByText('GIPHY is not configured.')).toBeVisible();
  },
};
