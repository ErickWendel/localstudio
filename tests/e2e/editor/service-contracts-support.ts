import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);
const workspaceRoot = process.cwd().replaceAll('\\', '/');

export const serviceContractsSupport = {
  commandsAllTrue: Array.from({ length: 11 }, () => true),
  editorSourceRoot: `/@fs${workspaceRoot}/apps/editor/src`,
  getServer,
  presenterRemoteSourceRoot: `/@fs${workspaceRoot}/packages/presenter-remote/src`,
  testSupportSourceRoot: `/@fs${workspaceRoot}/tests/e2e/support`,
};
