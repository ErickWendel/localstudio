import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function collectTestFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) return collectTestFiles(fullPath);
      return /\.(test|spec)\.[cm]?[tj]sx?$/.test(entry.name) ? [fullPath] : [];
    }),
  );

  return nested.flat();
}

describe('test organization', () => {
  it('keeps unit and component tests outside src', async () => {
    const testFiles = await collectTestFiles(join(process.cwd(), 'src'));

    expect(testFiles).toEqual([]);
  });
});
