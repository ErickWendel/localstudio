import { test as base, expect, type TestType } from '@playwright/test';
import { startIsolatedDevServer, type IsolatedDevServer } from './isolated-dev-server';

type JourneyFixtures = Record<string, never>;
type JourneyWorkerFixtures = Record<string, never>;

export const test = base;
export { expect };

export function withIsolatedDevServer(
  testType: TestType<JourneyFixtures, JourneyWorkerFixtures> = test,
) {
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
