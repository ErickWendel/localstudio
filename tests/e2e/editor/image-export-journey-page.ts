import { type Download, type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect } from '../support/journey-test';
import { remoteMirrorImportConfig } from './remote-mirror-import-config';

export const imageExportJourneyPage = {
  async downloadActivePagePng(page: Page, baseURL: string): Promise<Download> {
    await installFakeOpfs(page, { directoryPicker: true });
    await page.addInitScript((config) => {
      window.localStorage.setItem('localstudio.minioMirror.config', JSON.stringify(config));
      window.localStorage.setItem('ew-canvas-ai.mirror-enabled', 'false');
    }, remoteMirrorImportConfig);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Image Export');

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Share' }).click();
    const localSave = page.getByRole('dialog', { name: 'Save local project' });
    if (await localSave.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await localSave.getByRole('button', { name: 'Choose folder' }).click();
    }
    await expect(page.getByRole('complementary', { name: 'Share design panel' })).toBeVisible();
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
    ).toBeVisible({ timeout: 15_000 });

    await this.openImagesExportDialog(page, editor);
    await dismissPowerPointFontDialogIfPresent(page);
    await expect(
      page.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).not.toBeChecked();

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
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

async function dismissPowerPointFontDialogIfPresent(page: Page) {
  const backdrop = page.locator('.pptx-font-dialog-backdrop');
  if (!(await backdrop.isVisible({ timeout: 1_000 }).catch(() => false))) return;

  const dismissButton = backdrop
    .getByRole('button', {
      name: /continue|dismiss|close|done|skip|ok|use/i,
    })
    .first();
  if (await dismissButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await dismissButton.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await expect(backdrop).toBeHidden({ timeout: 5_000 });
}
