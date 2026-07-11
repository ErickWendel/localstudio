import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const coverageInputDir = join(workspaceRoot, 'test-results', 'editor-coverage-batches');
const playwrightCli = join(workspaceRoot, 'node_modules', 'playwright', 'cli.js');
const batchSize = Number.parseInt(process.env.E2E_COVERAGE_BATCH_SIZE ?? '4', 10);

if (!Number.isFinite(batchSize) || batchSize < 1) {
  throw new Error('E2E_COVERAGE_BATCH_SIZE must be a positive integer.');
}

rmSync(coverageInputDir, { force: true, recursive: true });
rmSync(join(workspaceRoot, 'coverage-report', 'editor'), { force: true, recursive: true });

const specFiles = [
  ...listSpecFiles('tests/e2e/editor'),
  ...listSpecFiles('tests/e2e/public-deck'),
  ...listSpecFiles('tests/e2e/webmcp'),
];
const batches = chunk(specFiles, batchSize);

for (const [index, batch] of batches.entries()) {
  const isLastBatch = index === batches.length - 1;
  const outputDir = join(coverageInputDir, `batch-${String(index + 1).padStart(2, '0')}`);
  const result = spawnSync(
    process.execPath,
    [
      playwrightCli,
      'test',
      '--project=chromium',
      `--output=${outputDir}`,
      ...batch,
    ],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        E2E_COVERAGE_INPUT_DIR: coverageInputDir,
        E2E_COVERAGE_SCOPE: 'editor',
        ...(isLastBatch ? {} : { E2E_COVERAGE_REPORT: '0' }),
      },
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function listSpecFiles(directory) {
  return readdirSync(join(workspaceRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
