import { type Page } from '@playwright/test';
import { strFromU8 } from 'fflate';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { pptxExportReader } from './pptx-export-reader';

export const pptxAnimationMediaExportFlow = {
  async run(page: Page, baseURL: string): Promise<void> {
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
    await page.getByLabel('Import media file').setInputFiles(getBigBuckBunnyMp4Fixture());
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Big_Buck_Bunny_360_10s_1MB.mp4', exact: true }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Movie' })
      .click();
    await page.getByLabel('Selected video start').selectOption('on-click');

    const files = await pptxExportReader.downloadFiles(page, editor, 'E2E Animation Media Export.pptx');
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
    expect(Object.keys(files).some((path) => path.startsWith('ppt/media/') && path.endsWith('.mp4'))).toBe(true);
  },
};
