import { EditorAppPage } from '../pages/editor-app.page';
import type { Page } from '@playwright/test';

async function gotoReady(page: Page, baseURL: string) {
  const editor = new EditorAppPage(page, baseURL);
  await editor.gotoNewProject();
}

export const modelRuntimeContractPage = {
  gotoReady,
};
