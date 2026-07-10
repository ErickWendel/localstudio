import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);
const workspaceRoot = process.cwd().replaceAll('\\', '/');

export const serviceContractsSupport = {
  commandsAllTrue: Array.from({ length: 11 }, () => true),
  getServer,
  presenterRemoteSourceRoot: `/@fs${workspaceRoot}/packages/presenter-remote/src`,
};
