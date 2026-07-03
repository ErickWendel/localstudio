import { describe, expect, it, vi } from 'vitest';
import { BrowserPptxImportService } from '../../../src/services/importing/pptx/pptxImportService';
import { createStoredPptxFile } from './pptxTestZip';

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:localstudio-test'),
});

const presentationXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`;

const presentationRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;

const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
  <Relationship Id="rIdPoster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/poster1.png"/>
  <Relationship Id="rIdVideo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="../media/media1.mp4"/>
</Relationships>`;

const layoutRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayoutImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/layout-icon.png"/>
</Relationships>`;

const layoutXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="20" name="Layout icon"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdLayoutImage"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="91440" y="91440"/><a:ext cx="457200" cy="457200"/></a:xfrm></p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="22" name="Author label"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="640080" y="91440"/><a:ext cx="457200" cy="228600"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="3000"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:t>Erick Wendel</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="21" name="Title placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Title Text</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;

const slideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="101010"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="3657600" cy="914400"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="ffcc00"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>Editable title</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="5" name="Default-sized text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="914400" y="2133600"/><a:ext cx="3657600" cy="914400"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="6000"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:rPr b="1"/><a:t>Default sized</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="3" name="Hero image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdImage"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="4572000" y="914400"/><a:ext cx="1828800" cy="914400"/></a:xfrm></p:spPr>
      </p:pic>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="4" name="Movie"/><p:cNvPicPr/><p:nvPr><a:videoFile r:link="rIdVideo"/><p14:media r:embed="rIdVideo"/></p:nvPr></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdPoster"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="4572000" y="2286000"/><a:ext cx="1828800" cy="1028700"/></a:xfrm></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:transition><p:fade/></p:transition>
  <p:timing>
    <p:tnLst>
      <p:par>
        <p:cTn id="1">
          <p:childTnLst>
            <p:par>
              <p:cTn id="2" nodeType="afterEffect" presetClass="entr" dur="700">
                <p:childTnLst><p:anim><p:cBhvr><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:anim></p:childTnLst>
              </p:cTn>
            </p:par>
            <p:par>
              <p:cTn id="3" nodeType="clickEffect" presetClass="exit" dur="450">
                <p:childTnLst><p:anim><p:cBhvr><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cBhvr></p:anim></p:childTnLst>
              </p:cTn>
            </p:par>
          </p:childTnLst>
        </p:cTn>
      </p:par>
    </p:tnLst>
    <p:bldLst>
      <p:bldP spid="3"/>
      <p:bldP spid="2"/>
    </p:bldLst>
  </p:timing>
</p:sld>`;

function createPptxFixture() {
  return createStoredPptxFile([
    { path: 'ppt/presentation.xml', contents: presentationXml },
    { path: 'ppt/_rels/presentation.xml.rels', contents: presentationRels },
    { path: 'ppt/slides/slide1.xml', contents: slideXml },
    { path: 'ppt/slides/_rels/slide1.xml.rels', contents: slideRels },
    { path: 'ppt/slideLayouts/slideLayout1.xml', contents: layoutXml },
    { path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', contents: layoutRels },
    { path: 'ppt/media/image1.png', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'ppt/media/layout-icon.png', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'ppt/media/poster1.png', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'ppt/media/media1.mp4', contents: new Uint8Array([0, 0, 0, 24]) },
  ]);
}

describe('BrowserPptxImportService', () => {
  it('imports editable text, original images, and playable video assets from PPTX', async () => {
    const service = new BrowserPptxImportService();
    const project = await service.importPowerPoint({ file: createPptxFixture() });

    expect(project.name).toBe('deck');
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]?.width).toBe(1920);
    expect(project.pages[0]?.height).toBe(1080);
    expect(project.pages[0]?.transition?.effect).toBe('fade');
    expect(project.pages[0]?.animationBuilds).toMatchObject([
      {
        elementId: 'pptx-page-1-slide-text-2',
        effect: 'reveal',
        trigger: 'after-transition',
        durationMs: 700,
        kind: 'build-in',
      },
      {
        elementId: 'pptx-page-1-slide-image-3',
        effect: 'reveal',
        trigger: 'on-click',
        durationMs: 450,
        kind: 'build-out',
      },
    ]);

    const elements = Object.values(project.elements);
    const textElement = elements.find(
      (element) => element.type === 'text' && element.text === 'Editable title',
    );
    const authorElement = elements.find(
      (element) => element.type === 'text' && element.text === 'Erick Wendel',
    );
    const defaultSizedElement = elements.find(
      (element) => element.type === 'text' && element.text === 'Default sized',
    );
    const imageElements = elements.filter((element) => element.type === 'image');
    const videoElement = elements.find((element) => element.type === 'video');
    const imageAsset = Object.values(project.assets).find((asset) => asset.fileName === 'image1.png');
    const layoutImageAsset = Object.values(project.assets).find((asset) => asset.fileName === 'layout-icon.png');
    const imageElement = imageElements.find((element) => element.assetId === imageAsset?.id);

    expect(textElement).toMatchObject({
      locked: false,
      text: 'Editable title',
      type: 'text',
      x: 192,
      y: 192,
      width: 768,
      height: 192,
      align: 'center',
      fontFamily: 'Arial',
      fontSize: 64,
      fontWeight: 700,
    });
    expect(authorElement).toMatchObject({
      locked: false,
      text: 'Erick Wendel',
      type: 'text',
      x: 134,
      y: 19,
      width: 603,
      height: 140,
    });
    expect(defaultSizedElement).toMatchObject({
      fontSize: 160,
      fontWeight: 700,
      text: 'Default sized',
      type: 'text',
    });
    expect(project.pages[0]?.elementIds.some((elementId) => elementId.includes('placeholder'))).toBe(false);
    expect(imageElements).toHaveLength(2);
    expect(imageElement).toMatchObject({ locked: false, type: 'image' });
    expect(videoElement).toMatchObject({ controls: true, locked: false, type: 'video' });

    const videoAsset = Object.values(project.assets).find((asset) => asset.fileName === 'media1.mp4');
    expect(imageAsset?.mimeType).toBe('image/png');
    expect(layoutImageAsset?.mimeType).toBe('image/png');
    expect(videoAsset?.mimeType).toBe('video/mp4');
  });

  it('rejects files that are not valid PPTX packages', async () => {
    const service = new BrowserPptxImportService();

    await expect(
      service.importPowerPoint({
        file: new File(['not a zip'], 'broken.pptx', {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
      }),
    ).rejects.toThrow('PowerPoint file is corrupt');
  });
});
