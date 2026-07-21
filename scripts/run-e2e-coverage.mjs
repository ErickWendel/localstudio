import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, join } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const workspaceRoot = process.cwd();
const playwrightCli = join(workspaceRoot, 'node_modules', 'playwright', 'cli.js');
const peerPath = '/peerjs';
const coverageWorkers = parsePositiveInteger(process.env.LOCALSTUDIO_E2E_WORKERS);
const e2eShard = parseShard(process.env.LOCALSTUDIO_E2E_SHARD);

const coverageRuns = {
  editor: {
    coverageScope: 'editor',
    dirs: ['tests/e2e/editor'],
    exclude: isEditorSourceContractSpec,
    needsPeerServer: false,
    outputName: 'editor',
    split: {
      grep: 'exports readable final slide states from the local PPTX sample when animation images are disabled',
      outputName: 'sample-pptx-export',
      spec: 'tests/e2e/editor/export-current-page-image.spec.ts',
    },
    warm: warmEditor,
    threshold: 80,
  },
  joystick: {
    coverageScope: 'joystick',
    dirs: ['tests/e2e/joystick'],
    exclude: isJoystickSourceContractSpec,
    needsPeerServer: true,
    outputName: 'joystick',
    threshold: 100,
    warm: warmJoystick,
  },
  'joystick-contracts': {
    coverageScope: 'joystick',
    dirs: ['tests/e2e/joystick'],
    exclude: (file) => !isJoystickSourceContractSpec(file),
    needsPeerServer: true,
    outputName: 'joystick-contracts',
    threshold: 0,
    warm: warmJoystick,
  },
  landing: {
    coverageScope: 'landing',
    dirs: ['tests/e2e/landing'],
    needsPeerServer: false,
    outputName: 'landing',
    threshold: 80,
    warm: warmLanding,
  },
  public: {
    coverageScope: 'editor',
    dirs: ['tests/e2e/public-deck'],
    needsPeerServer: false,
    outputName: 'public-deck',
    threshold: 0,
    warm: warmPublicDeck,
  },
  webmcp: {
    coverageScope: 'editor',
    dirs: ['tests/e2e/webmcp'],
    needsPeerServer: false,
    outputName: 'webmcp',
    threshold: 0,
    warm: warmWebMcp,
  },
  'editor-contracts': {
    coverageScope: 'editor',
    dirs: ['tests/e2e/editor'],
    exclude: (file) => !isEditorSourceContractSpec(file),
    needsPeerServer: false,
    outputName: 'editor-contracts',
    threshold: 0,
    warm: warmEditor,
  },
};

const runName = process.argv[2] ?? inferRunName(process.argv[1]);
const coverageRun = coverageRuns[runName];
if (!coverageRun) {
  console.error(`Usage: node scripts/run-e2e-coverage.mjs ${Object.keys(coverageRuns).join('|')}`);
  process.exit(1);
}

const outputName = process.env.LOCALSTUDIO_E2E_OUTPUT_NAME || coverageRun.outputName;
const coverageInputDir = join(workspaceRoot, 'test-results', `${outputName}-coverage`);
const coverageOutputDir = join(workspaceRoot, 'coverage-report', outputName);

rmSync(coverageInputDir, { force: true, recursive: true });
rmSync(coverageOutputDir, { force: true, recursive: true });

const specFiles = applyShard(
  coverageRun.dirs.flatMap((directory) =>
    listSpecFiles(directory).filter((file) => !coverageRun.exclude?.(file)),
  ),
  e2eShard,
);
const serverScript = process.env.E2E_SERVER === 'dev' ? 'scripts/dev.mjs' : 'scripts/serve-dist.mjs';

let peerServer;
let localStudioServer;
let exitCode = 0;

try {
  if (coverageRun.needsPeerServer) {
    const peerPort = await getFreePort();
    peerServer = {
      ...(await startReadyProcess({
        args: ['scripts/e2e-peer-server.mjs'],
        env: {
          HOST: '127.0.0.1',
          PEERJS_PATH: peerPath,
          PORT: String(peerPort),
        },
        readyPattern: /LocalStudio E2E PeerJS server ready:/,
        timeoutMs: 30_000,
      })),
      port: peerPort,
    };
  }

  localStudioServer = await startReadyProcess({
    args: [serverScript],
    env: createServerEnv(peerServer),
    readyPattern: /Local:\s+http:\/\/localhost:(\d+)\//,
    timeoutMs: 120_000,
  });

  const localStudioPort = Number.parseInt(localStudioServer.match?.[1] ?? '', 10);
  if (!Number.isInteger(localStudioPort)) {
    throw new Error('Could not resolve LocalStudio E2E server port.');
  }

  const baseURL = `http://localhost:${localStudioPort}`;
  await waitForOk(`${baseURL}/`);
  await coverageRun.warm(baseURL);

  if (shouldRunSplit(coverageRun.split, specFiles)) {
    const splitResult = runPlaywright(baseURL, localStudioPort, {
      env: { E2E_COVERAGE_REPORT: '0' },
      grep: coverageRun.split.grep,
      outputDir: join(coverageInputDir, coverageRun.split.outputName),
      specs: [coverageRun.split.spec],
      workers: 1,
    });
    exitCode = splitResult.status ?? 1;
  }

  if (exitCode === 0) {
    const result = runPlaywright(baseURL, localStudioPort, {
      grepInvert: coverageRun.split?.grep,
      outputDir: join(coverageInputDir, 'parallel'),
      specs: specFiles,
      workers: coverageWorkers,
    });
    exitCode = result.status ?? 1;
  }
} finally {
  if (localStudioServer) await stopProcess(localStudioServer.child);
  if (peerServer) await stopProcess(peerServer.child);
}

if (exitCode !== 0) process.exit(exitCode);

function createServerEnv(peerServer) {
  const env = {
    HOST: '127.0.0.1',
    PORT: '0',
    VITE_DISABLE_EDITOR_TOUR: process.env.VITE_DISABLE_EDITOR_TOUR ?? 'true',
  };
  if (!peerServer) return env;
  return {
    ...env,
    LOCALSTUDIO_PEERJS_HOST: '127.0.0.1',
    LOCALSTUDIO_PEERJS_PATH: peerPath,
    LOCALSTUDIO_PEERJS_PORT: String(peerServer.port),
  };
}

function inferRunName(scriptPath) {
  const scriptName = basename(scriptPath ?? '');
  if (scriptName.includes('editor')) return 'editor';
  if (scriptName.includes('joystick')) return 'joystick';
  return undefined;
}

function isEditorSourceContractSpec(file) {
  return (
    /^tests\/e2e\/editor\/service-contracts-.+\.spec\.ts$/.test(file) ||
    file === 'tests/e2e/editor/coverage-service-contracts.spec.ts' ||
    /(?:^|\/)[^/]*contracts\.spec\.ts$/.test(file)
  );
}

function isJoystickSourceContractSpec(file) {
  return /(?:^|\/)[^/]*contracts\.spec\.ts$/.test(file);
}

function listSpecFiles(directory) {
  return readdirSync(join(workspaceRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function runPlaywright(
  baseURL,
  port,
  { env = {}, grep, grepInvert, outputDir = coverageInputDir, specs = specFiles, workers } = {},
) {
  const args = [playwrightCli, 'test', '--project=chromium', `--output=${outputDir}`];
  if (workers) args.push('--workers', String(workers));
  if (grep) args.push('--grep', grep);
  if (grepInvert) args.push('--grep-invert', grepInvert);
  args.push(...specs);

  return spawnSync(process.execPath, args, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      ...env,
      E2E_COVERAGE_INPUT_DIR: coverageInputDir,
      E2E_COVERAGE_OUTPUT_DIR: coverageOutputDir,
      E2E_COVERAGE_SCOPE: coverageRun.coverageScope,
      E2E_COVERAGE_THRESHOLD: String(getCoverageThreshold(coverageRun)),
      LOCALSTUDIO_E2E_BASE_URL: baseURL,
      LOCALSTUDIO_E2E_PORT: String(port),
    },
    stdio: 'inherit',
  });
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

async function warmEditor(baseURL) {
  await warmRoutes(baseURL, [
    {
      path: '/editor/?newProject=1',
      waitFor: (page) => page.getByRole('heading', { name: 'LocalStudio.dev' }).waitFor(),
    },
    {
      path: '/editor/?presenter=1&presenterSession=warmup',
      waitFor: (page) => page.getByRole('main', { name: 'Presenter view' }).waitFor(),
    },
  ]);
}

async function warmJoystick(baseURL) {
  await warmRoutes(baseURL, [
    {
      path: '/joystick/',
      waitFor: (page) =>
        page.getByRole('main', { name: 'Presentation remote control' }).waitFor(),
    },
    {
      path: '/editor/?newProject=1',
      waitFor: (page) => page.getByRole('heading', { name: 'LocalStudio.dev' }).waitFor(),
    },
  ]);
}

async function warmLanding(baseURL) {
  await warmRoutes(baseURL, [
    {
      path: '/',
      waitFor: (page) =>
        page.getByRole('heading', { name: /Design slides with local AI/i }).waitFor(),
    },
  ]);
}

async function warmPublicDeck(baseURL) {
  await warmRoutes(baseURL, [
    { path: '/', waitFor: (page) => page.waitForLoadState('domcontentloaded') },
  ]);
}

async function warmWebMcp(baseURL) {
  await warmRoutes(baseURL, [
    {
      path: '/editor/webmcp',
      waitFor: (page) => page.getByRole('heading', { name: /WebMCP/i }).waitFor(),
    },
  ]);
}

async function warmRoutes(baseURL, routes) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const route of routes) {
      await page.goto(new URL(route.path, baseURL).toString());
      await route.waitFor(page);
    }
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

function parsePositiveInteger(value) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseShard(value) {
  if (!value) return undefined;
  const match = /^(\d+)\/(\d+)$/.exec(value);
  if (!match) {
    throw new Error(`LOCALSTUDIO_E2E_SHARD must use the form index/total, got ${value}.`);
  }
  const index = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1 || index > total) {
    throw new Error(`LOCALSTUDIO_E2E_SHARD must use 1-based bounds, got ${value}.`);
  }
  return { index, total };
}

function applyShard(files, shard) {
  if (!shard) return files;
  return files.filter((_file, fileIndex) => fileIndex % shard.total === shard.index - 1);
}

function shouldRunSplit(split, files) {
  if (!split) return false;
  return files.includes(split.spec);
}

function getCoverageThreshold(run) {
  const override = process.env.E2E_COVERAGE_THRESHOLD;
  if (override !== undefined) {
    const parsed = Number.parseFloat(override);
    if (Number.isFinite(parsed)) return parsed;
  }
  return run.threshold;
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
