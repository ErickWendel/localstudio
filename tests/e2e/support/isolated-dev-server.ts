import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface IsolatedDevServer {
  baseURL: string;
  port: number;
  stop: () => Promise<void>;
}

const serverReadyPattern = /Local:\s+http:\/\/localhost:(\d+)\//;

export async function startIsolatedDevServer(): Promise<IsolatedDevServer> {
  const serverEnv = { ...process.env };
  delete serverEnv.FORCE_COLOR;
  const child = spawn(process.execPath, ['scripts/dev.mjs'], {
    cwd: process.cwd(),
    env: {
      ...serverEnv,
      HOST: '127.0.0.1',
      PORT: '0',
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
      reject(error);
    });
    child.on('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
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
    stop: () => stopServer(child),
  };
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
