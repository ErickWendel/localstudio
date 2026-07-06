import { test as base, expect } from '@playwright/test';
import { collectBrowserCoverage } from './browser-coverage';
import { startIsolatedDevServer, type IsolatedDevServer } from './isolated-dev-server';

type JourneyFixtures = {
  browserCoverage: void;
};
type ServerLifecycle = Pick<typeof test, 'afterAll' | 'beforeAll'>;

export const test = base.extend<JourneyFixtures>({
  browserCoverage: [collectBrowserCoverage, { auto: true }],
});
export { expect };

export function withIsolatedDevServer(testType: ServerLifecycle = test) {
  let server: IsolatedDevServer | undefined;

  testType.beforeAll(async () => {
    server = await startIsolatedDevServer();
  });

  testType.afterAll(async () => {
    await server?.stop();
  });

  return () => {
    if (!server) throw new Error('Isolated dev server has not started yet.');
    return server;
  };
}
