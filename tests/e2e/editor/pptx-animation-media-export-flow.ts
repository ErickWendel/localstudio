import { readFile } from 'node:fs/promises';
import { type Page, type TestInfo } from '@playwright/test';
import { strFromU8 } from 'fflate';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { createTinyGifFixture, getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { pptxExportReader } from './pptx-export-reader';

export const pptxAnimationMediaExportFlow = {
  async run(page: Page, baseURL: string, testInfo: TestInfo): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Animation Media Export');

    await editor.openTool('Animate');
    await page.getByLabel('Slide transition effect').selectOption('dissolve');
    await page.getByRole('spinbutton', { name: 'Slide transition duration' }).fill('1.5');

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Animated export target');
    await editor.openTool('Animate');
    await page.getByLabel('New object animation effect').selectOption('dissolve');
    await page.getByRole('button', { name: 'Add animation' }).click();

    await editor.openTool('Assets');
    const videoBytes = await readFile(getBigBuckBunnyMp4Fixture());
    await page.getByLabel('Import media file').setInputFiles({
      buffer: videoBytes,
      mimeType: 'application/octet-stream',
      name: 'generic-video.mp4',
    });
    const gifBytes = await readFile(await createTinyGifFixture(testInfo));
    await page.getByLabel('Import media file').setInputFiles({
      buffer: gifBytes,
      mimeType: 'application/octet-stream',
      name: 'generic-animation.gif',
    });
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'generic-video.mp4', exact: true }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Movie' })
      .click();
    await page.getByLabel('Selected video start').selectOption('on-click');
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'generic-animation.gif', exact: true }).click();

    const files = await pptxExportReader.downloadFiles(page, editor, 'E2E Animation Media Export.pptx');
    const slideXml = strFromU8(files['ppt/slides/slide1.xml']);
    const contentTypesXml = strFromU8(files['[Content_Types].xml']);
    const slideRelsXml = strFromU8(files['ppt/slides/_rels/slide1.xml.rels']);

    expect(slideXml).toContain('<p:transition');
    expect(slideXml).toContain('<p:timing>');
    expect(slideXml).toContain('presetClass="entr"');
    expect(slideXml).toContain('presetClass="mediacall"');
    expect(slideXml).toContain('cmd="play"');
    expect(contentTypesXml).toContain('ContentType="image/gif"');
    expect(contentTypesXml).toContain('ContentType="video/mp4"');
    expect(slideRelsXml).toContain('/video');
    const gifPath = Object.keys(files).find(
      (path) => path.startsWith('ppt/media/') && path.endsWith('.gif'),
    );
    const videoPath = Object.keys(files).find(
      (path) => path.startsWith('ppt/media/') && path.endsWith('.mp4'),
    );
    expect(gifPath).toBeDefined();
    expect(videoPath).toBeDefined();
    if (!gifPath || !videoPath) throw new Error('Expected GIF and MP4 package parts.');
    expect(strFromU8(files[gifPath].subarray(0, 6))).toBe('GIF89a');
    expect(strFromU8(files[videoPath].subarray(4, 8))).toBe('ftyp');
  },
};
