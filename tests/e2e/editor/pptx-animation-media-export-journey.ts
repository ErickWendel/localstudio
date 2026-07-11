import { buffer } from 'node:stream/consumers';
import { type Page, type TestInfo } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

import { EditorAppPage } from '../pages/editor-app.page';
import { createTinyPngFixture, getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { expect } from '../support/journey-test';

export const pptxAnimationMediaExportJourney = {
  async runAnimationMediaExport(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Animation Media Export');

    await editor.openTool('Animate');
    await page.getByLabel('Slide transition effect').selectOption('dissolve');
    await page.getByRole('spinbutton', { name: 'Slide transition duration' }).fill('1.5');

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page.getByRole('tablist', { name: 'Movie inspector sections' }).getByRole('tab', { name: 'Text' }).click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Animated export target');
    await editor.openTool('Animate');
    await page.getByLabel('New object animation effect').selectOption('dissolve');
    await page.getByRole('button', { name: 'Add animation' }).click();

    await editor.openTool('Assets');
    await page.getByLabel('Import media file').setInputFiles(getBigBuckBunnyMp4Fixture());
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Big_Buck_Bunny_360_10s_1MB.mp4', exact: true }).click();
    await editor.openTool('Design');
    await page.getByRole('tablist', { name: 'Movie inspector sections' }).getByRole('tab', { name: 'Movie' }).click();
    await page.getByLabel('Selected video start').selectOption('on-click');

    const files = await exportPptx(page, editor, 'E2E Animation Media Export.pptx');
    const slideXml = strFromU8(files['ppt/slides/slide1.xml']);
    const contentTypesXml = strFromU8(files['[Content_Types].xml']);
    const slideRelsXml = strFromU8(files['ppt/slides/_rels/slide1.xml.rels']);

    expect(slideXml).toContain('<p:transition');
    expect(slideXml).toContain('<p:timing>');
    expect(slideXml).toContain('presetClass="entr"');
    expect(slideXml).toContain('presetClass="mediacall"');
    expect(slideXml).toContain('cmd="play"');
    expect(contentTypesXml).toContain('ContentType="video/mp4"');
    expect(slideRelsXml).toContain('/video');
    expect(Object.keys(files).some((path) => path.startsWith('ppt/media/') && path.endsWith('.mp4'))).toBe(
      true,
    );
  },

  async runShapeImageExport(page: Page, baseURL: string, testInfo: TestInfo): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Shape Image Export');

    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add arrow' }).click();
    await editor.openTool('Design');
    await expect(page.getByRole('region', { name: 'Selected shape controls' })).toBeVisible();
    await page.getByLabel('Selected shape fill mode').selectOption('color');
    await page.getByLabel('Selected shape fill color').fill('#37fd76');
    await page.getByLabel('Selected shape border mode').selectOption('color');
    await page.getByLabel('Selected shape border color').fill('#00779a');
    await page.getByLabel('Selected shape border width').fill('10');
    await page.getByLabel('Selected shape start endpoint').selectOption('circle');
    await page.getByLabel('Selected shape end endpoint').selectOption('arrow');

    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add circle' }).click();
    await editor.openTool('Design');
    await page.getByLabel('Selected shape fill color').fill('#ff0055');

    await editor.openTool('Assets');
    const imagePath = await createTinyPngFixture(testInfo);
    await page.getByLabel('Import media file').setInputFiles(imagePath);
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'localstudio-e2e-pixel.png', exact: true }).click();
    await page.getByRole('button', { name: 'Flip' }).click();

    const files = await exportPptx(page, editor, 'E2E Shape Image Export.pptx');
    const slideXml = strFromU8(files['ppt/slides/slide1.xml']);
    const slideRelsXml = strFromU8(files['ppt/slides/_rels/slide1.xml.rels']);

    expect(slideXml).toContain('prst="rightArrow"');
    expect(slideXml).toContain('prst="ellipse"');
    expect(slideXml).toContain('37FD76');
    expect(slideXml).toContain('FF0055');
    expect(slideRelsXml).toContain('/image');
    expect(Object.keys(files).some((path) => path.startsWith('ppt/media/') && path.endsWith('.png'))).toBe(
      true,
    );
  },
};

async function exportPptx(page: Page, editor: EditorAppPage, expectedFilename: string) {
  const downloadPromise = page.waitForEvent('download');
  await editor.openMenu('File');
  await page.getByRole('menuitem', { name: 'Export to' }).click();
  await page.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(expectedFilename);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const contents = await buffer(stream);
  return unzipSync(new Uint8Array(contents));
}
