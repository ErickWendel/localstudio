import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const editorIndex = resolve(root, 'dist/editor/index.html');
const webMcpIndex = resolve(root, 'dist/webmcp/index.html');
const editorWebMcpIndex = resolve(root, 'dist/editor/webmcp/index.html');

for (const target of [webMcpIndex, editorWebMcpIndex]) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(editorIndex, target);
}
