import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return collectSourceFiles(path);
    }

    if (!path.match(/\.(ts|tsx)$/) || path.endsWith('vite-env.d.ts')) {
      return [];
    }

    return [path];
  });
}

describe('landing export hygiene', () => {
  it('keeps landing source files to at most one export declaration', () => {
    const filesWithMultipleExports = collectSourceFiles(sourceRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const exportDeclarations = source.match(/^\s*export\s+/gm) ?? [];

      if (exportDeclarations.length <= 1) {
        return [];
      }

      return [`${file.replace(`${sourceRoot}/`, 'src/')}: ${exportDeclarations.length} exports`];
    });

    expect(filesWithMultipleExports).toEqual([]);
  });
});
