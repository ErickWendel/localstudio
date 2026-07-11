import { readFile, readdir } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import ts from 'typescript';

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

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'dist' || entry.name === 'node_modules') return [];
        return collectSourceFiles(fullPath);
      }
      if (entry.name.endsWith('.d.ts')) return [];
      return /\.(config\.)?[cm]?[tj]sx?$/.test(entry.name) ? [fullPath] : [];
    }),
  );

  return nested.flat();
}

function isAsyncFunctionLike(node: ts.Node): boolean {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;
  return (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
  );
}

function isValueExport(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node) ?? [];
  const hasExport = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  if (!hasExport) return false;
  const isTypeOnlyDeclaration =
    ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node);
  if (isTypeOnlyDeclaration) return false;
  return (
    ts.isClassDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isVariableStatement(node) ||
    ts.isEnumDeclaration(node)
  );
}

function isDefaultExportAssignment(node: ts.Node): boolean {
  return ts.isExportAssignment(node) && !node.isExportEquals;
}

function isValueReExport(node: ts.Node): boolean {
  if (!ts.isExportDeclaration(node)) return false;
  if (node.isTypeOnly) return false;
  if (!node.exportClause) return true;
  if (ts.isNamespaceExport(node.exportClause)) return true;
  return true;
}

async function getValueExportCount(filePath: string): Promise<number> {
  const sourceText = await readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  let count = 0;
  sourceFile.forEachChild((node) => {
    if (isValueExport(node) || isDefaultExportAssignment(node) || isValueReExport(node)) {
      count += 1;
    }
  });
  return count;
}

async function getE2eIsolationViolations(
  filePath: string,
  repositoryRoot: string,
): Promise<string[]> {
  const sourceText = await readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const relativePath = relative(repositoryRoot, filePath).split(sep).join('/');
  const violations: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'evaluate' &&
        node.arguments[0] &&
        isAsyncFunctionLike(node.arguments[0])
      ) {
        violations.push(`${relativePath}: inline async page.evaluate browser contract`);
      }

      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'waitForTimeout'
      ) {
        violations.push(`${relativePath}: fixed Playwright waitForTimeout delay`);
      }

      if (ts.isIdentifier(node.expression) && node.expression.text === 'waitDelay') {
        violations.push(`${relativePath}: fixed waitDelay helper`);
      }
    }

    node.forEachChild(visit);
  }

  visit(sourceFile);
  return violations;
}

describe('test organization', () => {
  it('keeps unit and component tests outside src', async () => {
    const testFiles = await collectTestFiles(join(process.cwd(), 'src'));

    expect(testFiles).toEqual([]);
  });

  it('keeps source files to one public value export and avoids barrels', async () => {
    const repositoryRoot = join(process.cwd(), '..', '..');
    const sourceRoots = [
      join(repositoryRoot, 'apps/editor/src'),
      join(repositoryRoot, 'apps/landing/src'),
      join(repositoryRoot, 'packages/brand/src'),
      join(repositoryRoot, 'packages/presenter-remote/src'),
      join(repositoryRoot, 'apps/joystick/src'),
      join(repositoryRoot, 'apps/editor/vite.config.ts'),
      join(repositoryRoot, 'apps/landing/vite.config.ts'),
      join(repositoryRoot, 'apps/joystick/vite.config.ts'),
    ];
    const sourceFiles = (
      await Promise.all(
        sourceRoots.map(async (sourceRoot) => {
          if (/\.[cm]?[tj]sx?$/.test(sourceRoot)) return [sourceRoot];
          return collectSourceFiles(sourceRoot);
        }),
      )
    ).flat();

    const violations: string[] = [];
    for (const filePath of sourceFiles) {
      const relativePath = relative(repositoryRoot, filePath).split(sep).join('/');
      if (basename(filePath) === 'index.ts') {
        violations.push(`${relativePath}: barrel files are not allowed`);
        continue;
      }

      const valueExportCount = await getValueExportCount(filePath);
      if (valueExportCount > 1) {
        violations.push(`${relativePath}: has ${valueExportCount} value exports`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps implementation files inside scoped context folders', async () => {
    const repositoryRoot = join(process.cwd(), '..', '..');
    const scopedRoots = [
      join(repositoryRoot, 'apps/editor/src/services'),
      join(repositoryRoot, 'apps/editor/src/domain'),
      join(repositoryRoot, 'apps/editor/src/domain/commands'),
      join(repositoryRoot, 'apps/editor/src/ui/editor'),
    ];
    const looseFiles: string[] = [];

    for (const scopedRoot of scopedRoots) {
      const entries = await readdir(scopedRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!/\.[cm]?[tj]sx?$/.test(entry.name)) continue;
        looseFiles.push(relative(repositoryRoot, join(scopedRoot, entry.name)).split(sep).join('/'));
      }
    }

    expect(looseFiles).toEqual([]);
  });

  it('keeps e2e browser runtime work isolated from specs and page objects', async () => {
    const repositoryRoot = join(process.cwd(), '..', '..');
    const e2eFiles = await collectSourceFiles(join(repositoryRoot, 'tests/e2e'));
    const violations = (
      await Promise.all(
        e2eFiles.map((filePath) => getE2eIsolationViolations(filePath, repositoryRoot)),
      )
    ).flat();

    expect(violations).toEqual([]);
  });
});
