import { test as base, expect } from '@playwright/test';
import { collectBrowserCoverage } from './browser-coverage';
import { startIsolatedDevServer, type IsolatedDevServer } from './isolated-dev-server';

type JourneyFixtures = {
  browserCoverage: void;
  isolatedDevServer: IsolatedDevServer;
};
type JourneyWorkerFixtures = {
  workerDevServer: IsolatedDevServer;
};

let currentServer: IsolatedDevServer | undefined;

export const test = base.extend<JourneyFixtures, JourneyWorkerFixtures>({
  workerDevServer: [
    async ({ browser }, use) => {
      void browser;
      const sharedBaseURL = process.env.LOCALSTUDIO_E2E_BASE_URL;
      const sharedPort = Number.parseInt(process.env.LOCALSTUDIO_E2E_PORT ?? '', 10);
      if (sharedBaseURL && Number.isInteger(sharedPort)) {
        await use({
          baseURL: sharedBaseURL,
          port: sharedPort,
          stop: async () => {
            await Promise.resolve();
          },
        });
        return;
      }

      const server = await startIsolatedDevServer();
      await use(server);
      await server.stop();
    },
    { scope: 'worker' },
  ],
  isolatedDevServer: [
    async ({ workerDevServer }, use) => {
      currentServer = workerDevServer;
      await use(workerDevServer);
    },
    { auto: true },
  ],
  browserCoverage: [
    async ({ browserName, context, isolatedDevServer }, use, testInfo) => {
      void isolatedDevServer;
      await collectBrowserCoverage({ browserName, context }, use, testInfo);
    },
    { auto: true },
  ],
});
export { expect };

export function withIsolatedDevServer(_testType: unknown = test) {
  void _testType;
  return () => {
    if (!currentServer) throw new Error('Isolated dev server has not started yet.');
    return currentServer;
  };
}
