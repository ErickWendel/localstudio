import type { TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { BrowserCoveragePayload, ScriptCoverageEntry } from './browser-coverage-types';

export const browserCoverageOutput = {
  async write(entries: ScriptCoverageEntry[], testInfo: TestInfo): Promise<void> {
    if (entries.length === 0) return;
    const outputPath = testInfo.outputPath('browser-coverage.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(createPayload(entries, testInfo), null, 2)}\n`);
  },
};

function createPayload(entries: ScriptCoverageEntry[], testInfo: TestInfo): BrowserCoveragePayload {
  return {
    entries,
    projectName: testInfo.project.name,
    testId: testInfo.testId,
    titlePath: testInfo.titlePath,
  };
}
