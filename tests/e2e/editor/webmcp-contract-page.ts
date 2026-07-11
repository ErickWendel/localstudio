import { type Page } from '@playwright/test';

import {
  evaluateWebMcpToolAdapterContract,
  type WebMcpToolAdapterContractResult,
} from './webmcp-tool-adapter-contract-browser';

export const webMcpContractPage = {
  async run(page: Page, baseURL: string): Promise<WebMcpToolAdapterContractResult> {
    await page.goto(new URL('/editor/?newProject=1', baseURL).toString());

    return page.evaluate(evaluateWebMcpToolAdapterContract);
  },
};
