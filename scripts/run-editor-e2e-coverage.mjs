import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const coverageInputDir = join(workspaceRoot, 'test-results', 'editor-coverage');
const playwrightCli = join(workspaceRoot, 'node_modules', 'playwright', 'cli.js');

rmSync(coverageInputDir, { force: true, recursive: true });
rmSync(join(workspaceRoot, 'coverage-report', 'editor'), { force: true, recursive: true });

const specFiles = [
  ...listSpecFiles('tests/e2e/editor'),
  ...listSpecFiles('tests/e2e/public-deck'),
  ...listSpecFiles('tests/e2e/webmcp'),
];

const result = spawnSync(
  process.execPath,
  [playwrightCli, 'test', '--project=chromium', `--output=${coverageInputDir}`, ...specFiles],
  {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      E2E_COVERAGE_INPUT_DIR: coverageInputDir,
      E2E_COVERAGE_SCOPE: 'editor',
    },
    stdio: 'inherit',
  },
);

if (result.status !== 0) process.exit(result.status ?? 1);

function listSpecFiles(directory) {
  return readdirSync(join(workspaceRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}
