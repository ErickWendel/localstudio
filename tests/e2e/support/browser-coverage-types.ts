import type { BrowserContext, Page } from '@playwright/test';

export interface ScriptCoverageEntry {
  functions: unknown[];
  scriptId: string;
  source?: string;
  url: string;
}

export interface BrowserCoverageFixtureInput {
  browserName: string;
  context: BrowserContext;
}

export interface BrowserCoveragePayload {
  entries: ScriptCoverageEntry[];
  projectName: string;
  testId: string;
  titlePath: string[];
}

export interface BrowserCoverageSession {
  page: Page;
  stop: () => Promise<ScriptCoverageEntry[]>;
}
