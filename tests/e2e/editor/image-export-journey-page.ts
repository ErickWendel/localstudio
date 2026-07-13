import { type Download, type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const imageExportJourneyPage = {
  async downloadActivePagePng(page: Page, baseURL: string): Promise<Download> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Image Export');

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Download' }).click();
    return downloadPromise;
  },

  async downloadAllSlidesZip(page: Page, baseURL: string): Promise<Download> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Images Archive');

    await this.openImagesExportDialog(page, editor);
    await expect(
      page.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export images' }).click();
    return downloadPromise;
  },

  async downloadSampleFinalSlideStatesZip(page: Page, baseURL: string): Promise<Download> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.goto('/editor/?newProject=1&importPptxSample=1');
    await expect(
      page.getByRole('button', {
        name: 'Edit project name fullstack-monitoring-jsnation-11062026',
      }),
    ).toBeVisible({ timeout: 150_000 });

    await this.openImagesExportDialog(page, editor);
    await expect(
      page.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).not.toBeChecked();

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Export images' }).click();
    return downloadPromise;
  },

  async openImagesExportDialog(page: Page, editor: EditorAppPage) {
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Images (.zip)' }).click();
    await expect(page.getByRole('dialog', { name: 'Export images' })).toBeVisible();
  },
};
