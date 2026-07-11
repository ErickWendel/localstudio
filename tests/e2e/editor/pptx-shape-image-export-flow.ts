import { type Page, type TestInfo } from '@playwright/test';
import { strFromU8 } from 'fflate';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { createTinyPngFixture } from '../support/test-assets';
import { pptxExportReader } from './pptx-export-reader';

export const pptxShapeImageExportFlow = {
  async run(page: Page, baseURL: string, testInfo: TestInfo): Promise<void> {
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

    const files = await pptxExportReader.downloadFiles(page, editor, 'E2E Shape Image Export.pptx');
    const slideXml = strFromU8(files['ppt/slides/slide1.xml']);
    const slideRelsXml = strFromU8(files['ppt/slides/_rels/slide1.xml.rels']);

    expect(slideXml).toContain('prst="rightArrow"');
    expect(slideXml).toContain('prst="ellipse"');
    expect(slideXml).toContain('37FD76');
    expect(slideXml).toContain('FF0055');
    expect(slideRelsXml).toContain('/image');
    expect(Object.keys(files).some((path) => path.startsWith('ppt/media/') && path.endsWith('.png'))).toBe(true);
  },
};
