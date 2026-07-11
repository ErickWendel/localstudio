import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';

export const layoutPresetContractPage = {
  async run<TResult, TInput>(
    page: Page,
    baseURL: string,
    evaluate: (input: TInput) => Promise<TResult>,
    input: TInput,
  ): Promise<TResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluate, input);
  },
};
