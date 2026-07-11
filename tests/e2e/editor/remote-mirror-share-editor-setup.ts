import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const remoteMirrorShareEditorSetup = {
  async createMirroredProject(editor: EditorAppPage, page: Page): Promise<void> {
    await editor.gotoNewProject();
    await editor.renameProject('E2E Mirrored Deck');
    await page.getByRole('button', { name: 'Browser storage disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();
  },
};
