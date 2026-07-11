import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { isolatedDevServerHttp } from './isolated-dev-server-http';
import type { IsolatedPeerServer, ReadyServerAddress } from './isolated-dev-server-types';

const serverReadyPattern = /Local:\s+http:\/\/localhost:(\d+)\//;

export const isolatedLocalStudioServer = {
  async start(peerServer: IsolatedPeerServer): Promise<{
    child: ChildProcessWithoutNullStreams;
    ready: ReadyServerAddress;
  }> {
    const serverEnv = { ...process.env };
    delete serverEnv.FORCE_COLOR;
    const serverScript =
      process.env.E2E_SERVER === 'dist' ? 'scripts/serve-dist.mjs' : 'scripts/dev.mjs';
    const child = spawn(process.execPath, [serverScript], {
      cwd: process.cwd(),
      env: {
        ...serverEnv,
        HOST: '127.0.0.1',
        LOCALSTUDIO_PEERJS_HOST: '127.0.0.1',
        LOCALSTUDIO_PEERJS_PATH: peerServer.path,
        LOCALSTUDIO_PEERJS_PORT: String(peerServer.port),
        PORT: '0',
        VITE_DISABLE_EDITOR_TOUR: serverEnv.VITE_DISABLE_EDITOR_TOUR ?? 'true',
      },
    });
    let output = '';
    let settled = false;

    const ready = await new Promise<ReadyServerAddress>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for LocalStudio dev server.\n${output}`));
      }, 120_000);

      function append(chunk: Buffer) {
        output += chunk.toString();
        const match = output.match(serverReadyPattern);
        if (!match || settled) return;
        const portValue = match[1];
        if (!portValue) return;
        settled = true;
        clearTimeout(timeout);
        const port = Number.parseInt(portValue, 10);
        resolve({ baseURL: `http://localhost:${port}`, port });
      }

      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        void peerServer.stop();
        reject(error);
      });
      child.on('exit', (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        void peerServer.stop();
        reject(
          new Error(
            `LocalStudio dev server exited before becoming ready with code ${String(
              code,
            )} and signal ${String(signal)}.\n${output}`,
          ),
        );
      });
    });

    await isolatedDevServerHttp.waitForOk(`${ready.baseURL}/`);
    return { child, ready };
  },
};
