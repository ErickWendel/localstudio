import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const coverageFiles = {
  async find(root: string): Promise<string[]> {
    const files: string[] = [];
    async function walk(directory: string) {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(path);
        } else if (entry.name === 'browser-coverage.json') {
          files.push(path);
        }
      }
    }
    await walk(root);
    return files.sort();
  },
};
