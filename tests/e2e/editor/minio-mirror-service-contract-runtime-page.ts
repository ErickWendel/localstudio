import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { evaluateMinioMirrorServiceContract } from './minio-mirror-service-contract-browser';

export const minioMirrorServiceContractRuntimePage = {
  async run(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluateMinioMirrorServiceContract);
  },
};
