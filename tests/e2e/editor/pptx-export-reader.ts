import { buffer } from 'node:stream/consumers';
import { type Page } from '@playwright/test';
import { unzipSync } from 'fflate';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const pptxExportReader = {
  async downloadFiles(page: Page, editor: EditorAppPage, expectedFilename: string) {
    const downloadPromise = page.waitForEvent('download');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(expectedFilename);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const contents = await buffer(stream);
    return unzipSync(new Uint8Array(contents));
  },
};
