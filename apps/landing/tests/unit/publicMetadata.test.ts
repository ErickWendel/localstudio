import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicRoot = join(process.cwd(), 'public');

describe('landing public metadata', () => {
  it('serves llms.txt as Markdown with a top-level heading', () => {
    const llmsText = readFileSync(join(publicRoot, 'llms.txt'), 'utf8');

    expect(llmsText).toMatch(/^# LocalStudio\.dev\s*$/m);
    expect(llmsText.trimStart()).toMatch(/^# /);
  });
});
