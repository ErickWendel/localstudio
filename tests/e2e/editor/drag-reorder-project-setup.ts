import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';

export async function createLayerReorderProject(page: Page, baseURL: string) {
  const editor = new EditorAppPage(page, baseURL);
  await editor.gotoNewProject();

  await editor.openTool('Text');
  await page.getByRole('button', { name: 'Add a text box' }).click();
  await editor.openTool('Design');
  await page
    .getByRole('tablist', { name: 'Movie inspector sections' })
    .getByRole('tab', { name: 'Text' })
    .click();
  await page.getByRole('textbox', { name: 'Selected text content' }).fill('Layer text');

  await editor.openTool('Elements');
  await page.getByRole('button', { name: 'Add square' }).click();

  return editor;
}
