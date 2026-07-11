import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

export async function installPptxFilePicker(page: Page, filePath: string) {
  const bytes = [...(await readFile(filePath))];
  const name = filePath.split('/').pop() ?? 'import.pptx';
  await page.evaluate(
    ({ fileBytes, fileName }) => {
      const pptxFile = new File([new Uint8Array(fileBytes)], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: () =>
          Promise.resolve([
            {
              getFile: () => Promise.resolve(pptxFile),
              kind: 'file',
              name: fileName,
            },
          ]),
      });
    },
    { fileBytes: bytes, fileName: name },
  );
}
