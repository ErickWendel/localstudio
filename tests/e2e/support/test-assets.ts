import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import type { TestInfo } from '@playwright/test';

const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const bigBuckBunnyMp4FixturePath = fileURLToPath(
  new URL('../fixtures/media/Big_Buck_Bunny_360_10s_1MB.mp4', import.meta.url),
);

export async function createTinyPngFixture(testInfo: TestInfo) {
  const filePath = testInfo.outputPath('localstudio-e2e-pixel.png');
  await writeFile(filePath, Buffer.from(tinyPngBase64, 'base64'));
  return filePath;
}

export function getBigBuckBunnyMp4Fixture() {
  if (!existsSync(bigBuckBunnyMp4FixturePath)) {
    throw new Error(`Missing Big Buck Bunny E2E video fixture: ${bigBuckBunnyMp4FixturePath}`);
  }
  return bigBuckBunnyMp4FixturePath;
}

export async function createTinyPptxFixture(testInfo: TestInfo) {
  const filePath = testInfo.outputPath('localstudio-e2e-import.pptx');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const firstSlide = pptx.addSlide();
  firstSlide.background = { color: '0B1F19' };
  firstSlide.addText('E2E imported deck', {
    bold: true,
    color: '37FD76',
    fontFace: 'Aptos Display',
    fontSize: 40,
    h: 0.8,
    w: 7,
    x: 0.8,
    y: 0.9,
  });
  firstSlide.addText('Editable slide content', {
    color: 'FFFFFF',
    fontFace: 'Aptos',
    fontSize: 24,
    h: 0.6,
    w: 7,
    x: 0.8,
    y: 2.0,
  });

  const secondSlide = pptx.addSlide();
  secondSlide.background = { color: '102028' };
  secondSlide.addText('Second imported slide', {
    color: 'FFFFFF',
    fontFace: 'Aptos Display',
    fontSize: 34,
    h: 0.8,
    w: 7,
    x: 0.8,
    y: 1.2,
  });

  await pptx.writeFile({ fileName: filePath });
  return filePath;
}

export async function createInvalidPptxFixture(testInfo: TestInfo) {
  const filePath = testInfo.outputPath('localstudio-e2e-invalid.pptx');
  await writeFile(filePath, 'not a real PowerPoint package');
  return filePath;
}
