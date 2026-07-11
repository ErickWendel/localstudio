import { type Page } from '@playwright/test';

export const webMcpContractPage = {
  async run<TResult>(
    page: Page,
    baseURL: string,
    evaluate: () => Promise<TResult>,
  ): Promise<TResult> {
    await page.goto(new URL('/editor/?newProject=1', baseURL).toString());

    return page.evaluate(evaluate);
  },
};
