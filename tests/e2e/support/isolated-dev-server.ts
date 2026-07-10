import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';

export interface IsolatedDevServer {
  baseURL: string;
  port: number;
  stop: () => Promise<void>;
}

const serverReadyPattern = /Local:\s+http:\/\/localhost:(\d+)\//;

export async function startIsolatedDevServer(): Promise<IsolatedDevServer> {
  const serverEnv = { ...process.env };
  delete serverEnv.FORCE_COLOR;
  const peerServer = await startPeerServer();
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

  const ready = await new Promise<{ baseURL: string; port: number }>((resolve, reject) => {
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
          `LocalStudio dev server exited before becoming ready with code ${String(code)} and signal ${String(
            signal,
          )}.\n${output}`,
        ),
      );
    });
  });

  await waitForHttpOk(`${ready.baseURL}/`);

  return {
    ...ready,
    stop: async () => {
      await Promise.all([stopServer(child), peerServer.stop()]);
    },
  };
}

async function startPeerServer() {
  const port = await getFreePort();
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
  await waitForHttpOk(`http://127.0.0.1:${port}${path}/peerjs/id`);
  return {
    path,
    port,
    stop: () => stopServer(child),
  };
}

async function getFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to allocate a free local port.'));
          return;
        }
        resolve(address.port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForHttpOk(url: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until the server accepts connections.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopServer(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
