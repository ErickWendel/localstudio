import { type Locator, type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { presenterKeyboardFullscreenMock } from './presenter-keyboard-fullscreen-mock';

export const presenterKeyboardVideoSetup = {
  async addVideoAndSecondSlide(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.openTool('Assets');
    await page.getByLabel('Import media file').setInputFiles(getBigBuckBunnyMp4Fixture());
    await expect(page.getByText('Big_Buck_Bunny_360_10s_1MB.mp4')).toBeVisible();

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Big_Buck_Bunny_360_10s_1MB.mp4', exact: true }).click();

    await editor.openPagesPanel();
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
    await pagesPanel.getByLabel('Add page').click();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Keyboard close');
    await page.getByLabel('Page 2 title').press('Enter');
    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();
  },

  async enterFullscreenPresentation(editor: EditorAppPage, page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await page.getByRole('menuitem', { name: /Present in fullscreen/i }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  },

  async installFullscreenMock(page: Page): Promise<void> {
    await presenterKeyboardFullscreenMock.install(page);
  },

  async openKeyboardShortcuts(editor: EditorAppPage, page: Page): Promise<Locator> {
    await editor.openMenu('Help');
    await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();
    const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(shortcuts).toBeVisible();
    return shortcuts;
  },

  async prepareVideo(workspace: Locator): Promise<Locator> {
    const video = workspace
      .locator('video.canvas-media-element[aria-label="Big_Buck_Bunny_360_10s_1MB.mp4"]')
      .first();
    await expect(video).toBeVisible();
    await video.evaluate(
      (element) =>
        new Promise<void>((resolve) => {
          const movie = element as HTMLVideoElement;
          if (Number.isFinite(movie.duration) && movie.duration > 0) {
            resolve();
            return;
          }
          movie.addEventListener('loadedmetadata', () => resolve(), { once: true });
        }),
    );
    await video.evaluate((element) => {
      const movie = element as HTMLVideoElement;
      movie.muted = true;
      movie.pause();
      movie.currentTime = Math.min(1, Number.isFinite(movie.duration) ? movie.duration / 2 : 1);
    });
    return video;
  },
};
