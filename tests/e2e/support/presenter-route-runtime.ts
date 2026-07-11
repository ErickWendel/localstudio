import type { Page as PlaywrightPage } from '@playwright/test';

import { presenterRouteInitScript } from './presenter-route-init-script';
import { presenterRoutePayload } from './presenter-route-payload';

export const presenterRouteRuntime = {
  async install(page: PlaywrightPage): Promise<void> {
    const initialPayload = presenterRoutePayload.create('slide-1');
    await page.addInitScript({
      content: presenterRouteInitScript.createContent(initialPayload),
    });
  },
};
