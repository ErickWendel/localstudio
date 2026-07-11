import type { Page } from '@playwright/test';
import { EditorAppPage } from '../pages/editor-app.page';

export const presenterSignalingContractPage = {
  async gotoReady(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
  },
  async run<TResult, TInput>(
    page: Page,
    baseURL: string,
    evaluate: (input: TInput) => Promise<TResult>,
    input: TInput,
  ): Promise<TResult> {
    await this.gotoReady(page, baseURL);
    return page.evaluate(evaluate, input);
  },
};
