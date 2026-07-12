import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const workspaceRoot = process.cwd();
const coverageInputDir = join(workspaceRoot, 'test-results', 'joystick-coverage');
const playwrightCli = join(workspaceRoot, 'node_modules', 'playwright', 'cli.js');
const peerPath = '/peerjs';

rmSync(coverageInputDir, { force: true, recursive: true });
rmSync(join(workspaceRoot, 'coverage-report', 'joystick'), { force: true, recursive: true });

const specFiles = listSpecFiles('tests/e2e/joystick');

const peerPort = await getFreePort();
let peerServer;
let localStudioServer;
let exitCode = 0;

try {
  peerServer = await startReadyProcess({
    args: ['scripts/e2e-peer-server.mjs'],
    env: {
      HOST: '127.0.0.1',
      PEERJS_PATH: peerPath,
      PORT: String(peerPort),
    },
    readyPattern: /LocalStudio E2E PeerJS server ready:/,
    timeoutMs: 30_000,
  });

  localStudioServer = await startReadyProcess({
    args: ['scripts/dev.mjs'],
    env: {
      HOST: '127.0.0.1',
      LOCALSTUDIO_PEERJS_HOST: '127.0.0.1',
      LOCALSTUDIO_PEERJS_PATH: peerPath,
      LOCALSTUDIO_PEERJS_PORT: String(peerPort),
      PORT: '0',
      VITE_DISABLE_EDITOR_TOUR: process.env.VITE_DISABLE_EDITOR_TOUR ?? 'true',
    },
    readyPattern: /Local:\s+http:\/\/localhost:(\d+)\//,
    timeoutMs: 120_000,
  });

  const localStudioPort = Number.parseInt(localStudioServer.match?.[1] ?? '', 10);
  if (!Number.isInteger(localStudioPort)) {
    throw new Error('Could not resolve LocalStudio E2E server port.');
  }

  const baseURL = `http://localhost:${localStudioPort}`;
  await waitForOk(`${baseURL}/`);
  await warmJoystick(baseURL);

  const result = runPlaywright(baseURL, localStudioPort);
  exitCode = result.status ?? 1;
} finally {
  if (localStudioServer) await stopProcess(localStudioServer.child);
  if (peerServer) await stopProcess(peerServer.child);
}

if (exitCode !== 0) process.exit(exitCode);

function listSpecFiles(directory) {
  return readdirSync(join(workspaceRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function runPlaywright(baseURL, port) {
  return spawnSync(
    process.execPath,
    [playwrightCli, 'test', '--project=chromium', `--output=${coverageInputDir}`, ...specFiles],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        E2E_COVERAGE_INPUT_DIR: coverageInputDir,
        E2E_COVERAGE_SCOPE: 'joystick',
        LOCALSTUDIO_E2E_BASE_URL: baseURL,
        LOCALSTUDIO_E2E_PORT: String(port),
      },
      stdio: 'inherit',
    },
  );
}

async function startReadyProcess({ args, env, readyPattern, timeoutMs }) {
  const child = spawn(process.execPath, args, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      ...env,
    },
  });
  let output = '';
  let settled = false;

  const match = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${args.join(' ')}.\n${output}`));
    }, timeoutMs);

    function append(chunk) {
      output += chunk.toString();
      const match = output.match(readyPattern);
      if (!match || settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(match);
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
          `${args.join(' ')} exited before becoming ready with code ${String(
            code,
          )} and signal ${String(signal)}.\n${output}`,
        ),
      );
    });
  });

  return { child, match };
}

async function waitForOk(url) {
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

async function warmJoystick(baseURL) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(new URL('/joystick/', baseURL).toString());
    await page.getByRole('main', { name: 'Presentation remote control' }).waitFor({
      timeout: 30_000,
    });
    await page.goto(new URL('/editor/?newProject=1', baseURL).toString());
    await page.getByRole('heading', { name: 'LocalStudio.dev' }).waitFor({ timeout: 30_000 });
  } finally {
    await browser.close();
  }
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
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

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
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
