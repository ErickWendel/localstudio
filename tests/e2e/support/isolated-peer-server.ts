import { spawn } from 'node:child_process';

import { isolatedDevServerHttp } from './isolated-dev-server-http';
import { isolatedDevServerPort } from './isolated-dev-server-port';
import { isolatedDevServerProcess } from './isolated-dev-server-process';
import type { IsolatedPeerServer } from './isolated-dev-server-types';

export const isolatedPeerServer = {
  async start(): Promise<IsolatedPeerServer> {
    const port = await isolatedDevServerPort.getFreePort();
    const path = '/peerjs';
    const child = spawn(process.execPath, ['scripts/e2e-peer-server.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PEERJS_PATH: path,
        PORT: String(port),
      },
    });
    let output = '';
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for LocalStudio E2E PeerJS server.\n${output}`));
      }, 30_000);

      function append(chunk: Buffer) {
        output += chunk.toString();
        if (!output.includes('LocalStudio E2E PeerJS server ready:')) return;
        clearTimeout(timeout);
        resolve();
      }

      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on('exit', (code, signal) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `LocalStudio E2E PeerJS server exited before becoming ready with code ${String(
              code,
            )} and signal ${String(signal)}.\n${output}`,
          ),
        );
      });
    });
    await isolatedDevServerHttp.waitForOk(`http://127.0.0.1:${port}${path}/peerjs/id`);
    return {
      path,
      port,
      stop: () => isolatedDevServerProcess.stop(child),
    };
  },
};
