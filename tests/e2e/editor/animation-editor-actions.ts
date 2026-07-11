import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';

export const animationEditorActions = {
  async addNamedTextElement(editor: EditorAppPage, page: Page, name: string): Promise<void> {
    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill(name);
  },

  async selectLayer(editor: EditorAppPage, page: Page, name: string): Promise<void> {
    await editor.openTool('Layout');
    await page.locator(`.layer-list article[role="button"][aria-label="${name}"]`).click();
  },
};
