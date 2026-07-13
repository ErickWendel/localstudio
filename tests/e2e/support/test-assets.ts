import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import type { TestInfo } from '@playwright/test';
import { createStoredPptxFile } from '../../../apps/editor/tests/unit/services/pptxTestZip';

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

export async function createInheritedThemeFontPptxFixture(testInfo: TestInfo) {
  const filePath = testInfo.outputPath('localstudio-e2e-inherited-theme-font.pptx');
  const pptx = createStoredPptxFile(
    [
      {
        path: '[Content_Types].xml',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`,
      },
      {
        path: '_rels/.rels',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdPresentation" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
      },
      {
        path: 'ppt/presentation.xml',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>
  <p:sldIdLst><p:sldId id="256" r:id="rIdSlide"/></p:sldIdLst>
  <p:defaultTextStyle>
    <a:defPPr><a:defRPr sz="1800"/></a:defPPr>
    <a:lvl1pPr><a:defRPr sz="3600"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr>
  </p:defaultTextStyle>
</p:presentation>`,
      },
      {
        path: 'ppt/_rels/presentation.xml.rels',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`,
      },
      {
        path: 'ppt/slides/slide1.xml',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Inherited font text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="5486400" cy="914400"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Inherited Tenorite text</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
      },
      {
        path: 'ppt/slides/_rels/slide1.xml.rels',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`,
      },
      {
        path: 'ppt/slideLayouts/slideLayout1.xml',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`,
      },
      {
        path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
      },
      {
        path: 'ppt/slideMasters/slideMaster1.xml',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rIdLayout"/></p:sldLayoutIdLst>
</p:sldMaster>`,
      },
      {
        path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
      },
      {
        path: 'ppt/theme/theme1.xml',
        contents: `<?xml version="1.0" encoding="UTF-8"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:clrScheme name="LocalStudio"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="ffffff"/></a:lt1></a:clrScheme>
    <a:fontScheme name="LocalStudio Fonts"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Tenorite"/></a:minorFont></a:fontScheme>
  </a:themeElements>
</a:theme>`,
      },
    ],
    'localstudio-e2e-inherited-theme-font.pptx',
  );
  await writeFile(filePath, Buffer.from(await pptx.arrayBuffer()));
  return filePath;
}

export async function createInvalidPptxFixture(testInfo: TestInfo) {
  const filePath = testInfo.outputPath('localstudio-e2e-invalid.pptx');
  await writeFile(filePath, 'not a real PowerPoint package');
  return filePath;
}
