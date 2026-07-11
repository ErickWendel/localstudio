import { isolatedDevServerProcess } from './isolated-dev-server-process';
import { isolatedLocalStudioServer } from './isolated-localstudio-server';
import { isolatedPeerServer } from './isolated-peer-server';
import type { IsolatedDevServer } from './isolated-dev-server-types';

export type { IsolatedDevServer } from './isolated-dev-server-types';

export async function startIsolatedDevServer(): Promise<IsolatedDevServer> {
  const peerServer = await isolatedPeerServer.start();
  const { child, ready } = await isolatedLocalStudioServer.start(peerServer);

  return {
    ...ready,
    stop: async () => {
      await Promise.all([isolatedDevServerProcess.stop(child), peerServer.stop()]);
    },
  };
}
