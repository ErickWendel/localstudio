import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const presenterNotesEditorMenu = {
  async verifyPresentationMenuAndEditorShortcuts(editor: EditorAppPage, page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await expect(page.getByRole('menu', { name: 'Presentation play menu' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Present in fullscreen/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Presenter view/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Play from beginning/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await editor.openMenu('Help');
    await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toContainText(
      'Open the slide navigator',
    );
    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
  },
};
