import { buffer } from 'node:stream/consumers';
import { inflateSync } from 'node:zlib';
import { unzipSync } from 'fflate';
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

function readPngVisiblePixelRatio(bytes: Uint8Array) {
  const signature = Buffer.from(bytes.subarray(0, 8));
  expect(signature).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Buffer[] = [];
  while (offset < bytes.length) {
    const length = Buffer.from(bytes.subarray(offset, offset + 4)).readUInt32BE(0);
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString('ascii');
    const data = Buffer.from(bytes.subarray(offset + 8, offset + 8 + length));
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  let readOffset = 0;
  const paeth = (left: number, up: number, upperLeft: number) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = raw[readOffset++];
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] ?? 0 : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] ?? 0 : 0;
      const value = raw[readOffset++] ?? 0;
      let decoded: number;
      if (filter === 0) decoded = value;
      else if (filter === 1) decoded = value + left;
      else if (filter === 2) decoded = value + up;
      else if (filter === 3) decoded = value + Math.floor((left + up) / 2);
      else if (filter === 4) decoded = value + paeth(left, up, upperLeft);
      else throw new Error(`Unsupported PNG filter ${filter}.`);
      pixels[y * stride + x] = decoded & 0xff;
    }
  }

  let visiblePixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0)) / 3;
    if (luminance > 24) visiblePixels += 1;
  }
  return visiblePixels / (width * height);
}

test.describe('editor current page image export journey', () => {
  test('downloads the active page as a PNG from the share panel', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Image Export');

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const contents = await buffer(stream);
    expect(contents.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  test('downloads all slides as an image ZIP from the File menu', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Images Archive');

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Images (.zip)' }).click();

    await expect(page.getByRole('dialog', { name: 'Export images' })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export images' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-images\.zip$/);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const contents = await buffer(stream);
    expect(contents.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  test('exports readable final slide states from the local PPTX sample when animation images are disabled', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.goto('/editor/?newProject=1&importPptxSample=1');
    await expect(
      page.getByRole('button', {
        name: 'Edit project name fullstack-monitoring-jsnation-11062026',
      }),
    ).toBeVisible({ timeout: 90_000 });

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Images (.zip)' }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).not.toBeChecked();

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Export images' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const archiveBytes = await buffer(stream);
    const archiveFiles = unzipSync(new Uint8Array(archiveBytes));
    const suspectSlides = [1, 5, 19, 24, 25, 27, 30, 40, 42, 50].map(
      (slideNumber) => `fullstack-monitoring-jsnation-11062026-Slide ${slideNumber}.png`,
    );
    const blackSlides = suspectSlides.filter((fileName) => {
      const imageBytes = archiveFiles[fileName];
      expect(imageBytes, `${fileName} should exist in the image archive`).toBeDefined();
      if (!imageBytes) return true;
      return readPngVisiblePixelRatio(imageBytes) < 0.01;
    });
    expect(blackSlides).toEqual([]);
  });
});
