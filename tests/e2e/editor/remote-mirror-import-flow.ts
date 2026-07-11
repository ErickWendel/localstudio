import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const remoteMirrorImportFlow = {
  async importRemoteMirrorDeck(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    await page.getByRole('menuitem', { name: 'Remote' }).click();
    await expect(page.getByRole('dialog', { name: 'Import remote project' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Remote mirrored projects' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Import Remote Mirror Deck' }).click();
  },

  async verifyImportedProject(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: 'Edit project name Remote Mirror Deck' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Rename Remote Slide' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Import remote project' })).toBeHidden();
  },
};
