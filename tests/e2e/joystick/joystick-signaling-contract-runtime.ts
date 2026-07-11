import type { Page } from '@playwright/test';

export const joystickSignalingContractRuntime = {
  presenterRemoteSourceRoot: `/@fs${process.cwd()}/packages/presenter-remote/src`,
  testSupportSourceRoot: `/@fs${process.cwd()}/tests/e2e/support`,

  async gotoReady(page: Page, baseURL: string) {
    await page.goto(new URL('/joystick/', baseURL).toString());
  },
};
