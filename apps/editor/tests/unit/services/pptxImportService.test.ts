import { describe, expect, it, vi } from 'vitest';
import { BrowserPptxImportService } from '../../../src/services/importing/pptx/pptxImportService';
import { createStoredPptxFile } from './pptxTestZip';

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:localstudio-test'),
});

const presentationXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rIdMaster"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:defaultTextStyle>
    <a:defPPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" algn="l">
      <a:defRPr sz="1800"/>
    </a:defPPr>
    <a:lvl1pPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" algn="ctr">
      <a:defRPr sz="2400"/>
    </a:lvl1pPr>
  </p:defaultTextStyle>
</p:presentation>`;

const presentationRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`;

const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
  <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
  <Relationship Id="rIdPoster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/poster1.png"/>
  <Relationship Id="rIdVideo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="../media/media1.mp4"/>
</Relationships>`;

const layoutRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayoutImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/layout-icon.png"/>
  <Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

const layoutXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld name="Statement">
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
        <p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr algn="l"/></a:lstStyle><a:p><a:pPr><a:defRPr sz="3000"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:t>Erick Wendel</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="21" name="Title placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Title Text</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;

const unusedLayoutXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld name="Title &amp; Photo">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="31" name="Photo title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="3657600" cy="457200"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Photo title</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="32" name="Photo placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="pic"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="4572000" y="914400"/><a:ext cx="1828800" cy="2743200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;

const masterRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdLayout2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>
</Relationships>`;

const masterXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld name="21_BasicWhite"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="1" r:id="rIdLayout1"/>
    <p:sldLayoutId id="2" r:id="rIdLayout2"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;

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
      <p:sp>
        <p:nvSpPr><p:cNvPr id="6" name="Centered text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="2743200" y="3657600"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr lIns="91440" rIns="91440" tIns="45720" bIns="45720" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>Centered expansion</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="7" name="Inherited centered caption"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="2743200" y="4572000"/><a:ext cx="1828800" cy="457200"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr sz="2400"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>Inherited centered</a:t></a:r></a:p></p:txBody>
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
            <p:par>
              <p:cTn id="4" nodeType="clickEffect" presetClass="mediacall">
                <p:childTnLst><p:cmd type="call" cmd="play"><p:cBhvr><p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst>
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

const notesSlideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Slide image placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Do not import slide thumbnail text</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:t>Open with the PowerPoint import story.</a:t></a:r></a:p>
          <a:p><a:r><a:t>Then demo editable speaker notes.</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;

function createPptxFixture(slideContents = slideXml) {
  return createStoredPptxFile([
    { path: 'ppt/presentation.xml', contents: presentationXml },
    { path: 'ppt/_rels/presentation.xml.rels', contents: presentationRels },
    { path: 'ppt/slides/slide1.xml', contents: slideContents },
    { path: 'ppt/slides/_rels/slide1.xml.rels', contents: slideRels },
    { path: 'ppt/notesSlides/notesSlide1.xml', contents: notesSlideXml },
    { path: 'ppt/slideLayouts/slideLayout1.xml', contents: layoutXml },
    { path: 'ppt/slideLayouts/slideLayout2.xml', contents: unusedLayoutXml },
    { path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', contents: layoutRels },
    { path: 'ppt/slideMasters/slideMaster1.xml', contents: masterXml },
    { path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', contents: masterRels },
    { path: 'ppt/media/image1.png', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'ppt/media/layout-icon.png', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'ppt/media/poster1.png', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'ppt/media/media1.mp4', contents: new Uint8Array([0, 0, 0, 24]) },
  ]);
}

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/deck/main.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/deck/media/photo.dat" ContentType="image/png"/>
</Types>`;

const packageRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdPresentation" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="deck/main.xml"/>
</Relationships>`;

const standardPresentationXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rIdSlide"/>
  </p:sldIdLst>
</p:presentation>`;

const standardPresentationRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slideA.xml"/>
</Relationships>`;

const standardSlideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../layouts/layoutA.xml"/>
  <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/photo.dat"/>
  <Relationship Id="rIdExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.com/external.png" TargetMode="External"/>
  <Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

const standardLayoutRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../masters/masterA.xml"/>
</Relationships>`;

const standardMasterRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/themeA.xml"/>
</Relationships>`;

const standardLayoutXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`;

const standardMasterXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldMaster>`;

const standardThemeXml = `<?xml version="1.0" encoding="UTF-8"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:clrScheme name="LocalStudio">
      <a:dk1><a:srgbClr val="111111"/></a:dk1>
      <a:lt1><a:srgbClr val="ffffff"/></a:lt1>
      <a:accent1><a:srgbClr val="ff9900"/></a:accent1>
    </a:clrScheme>
  </a:themeElements>
</a:theme>`;

const standardSlideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="10" name="Theme shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm rot="5400000"><a:off x="914400" y="914400"/><a:ext cx="914400" cy="457200"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:ln>
        </p:spPr>
      </p:sp>
      <p:grpSp>
        <p:nvGrpSpPr><p:cNvPr id="20" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="1828800" y="914400"/><a:ext cx="1828800" cy="914400"/><a:chOff x="0" y="0"/><a:chExt cx="1828800" cy="914400"/></a:xfrm></p:grpSpPr>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="21" name="Grouped diamond"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr>
            <a:xfrm><a:off x="0" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm>
            <a:prstGeom prst="diamond"><a:avLst/></a:prstGeom>
            <a:solidFill><a:srgbClr val="00aa66"/></a:solidFill>
          </p:spPr>
        </p:sp>
      </p:grpSp>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="30" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="914400" y="2286000"/><a:ext cx="1828800" cy="914400"/></p:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl>
            <a:tblGrid><a:gridCol w="914400"/><a:gridCol w="914400"/></a:tblGrid>
            <a:tr h="457200">
              <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Cell A</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="222222"/></a:solidFill></a:tcPr></a:tc>
              <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Cell B</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:tcPr></a:tc>
            </a:tr>
          </a:tbl>
        </a:graphicData></a:graphic>
      </p:graphicFrame>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="40" name="Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="4572000" y="914400"/><a:ext cx="914400" cy="914400"/></p:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdChart"/></a:graphicData></a:graphic>
      </p:graphicFrame>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="50" name="Content-type image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdImage"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="4572000" y="2286000"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>
      </p:pic>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="51" name="External image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdExternal"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="4572000" y="3200400"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`;

function createStandardsFixture() {
  return createStoredPptxFile([
    { path: '[Content_Types].xml', contents: contentTypesXml },
    { path: '_rels/.rels', contents: packageRels },
    { path: 'deck/main.xml', contents: standardPresentationXml },
    { path: 'deck/_rels/main.xml.rels', contents: standardPresentationRels },
    { path: 'deck/slides/slideA.xml', contents: standardSlideXml },
    { path: 'deck/slides/_rels/slideA.xml.rels', contents: standardSlideRels },
    { path: 'deck/layouts/layoutA.xml', contents: standardLayoutXml },
    { path: 'deck/layouts/_rels/layoutA.xml.rels', contents: standardLayoutRels },
    { path: 'deck/masters/masterA.xml', contents: standardMasterXml },
    { path: 'deck/masters/_rels/masterA.xml.rels', contents: standardMasterRels },
    { path: 'deck/theme/themeA.xml', contents: standardThemeXml },
    { path: 'deck/media/photo.dat', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'deck/charts/chart1.xml', contents: '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>' },
  ], 'standards.pptx');
}

describe('BrowserPptxImportService', () => {
  it('imports editable text, original images, and playable video assets from PPTX', async () => {
    const service = new BrowserPptxImportService();
    const project = await service.importPowerPoint({ file: createPptxFixture() });

    expect(project.name).toBe('deck');
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]?.width).toBe(1920);
    expect(project.pages[0]?.height).toBe(1080);
    expect(project.pages[0]?.speakerNotes).toBe(
      'Open with the PowerPoint import story.\nThen demo editable speaker notes.',
    );
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
      {
        elementId: 'pptx-page-1-slide-video-4',
        effect: 'reveal',
        trigger: 'on-click',
        durationMs: 0,
        kind: 'build-in',
        mediaAction: 'play',
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
    const centeredElement = elements.find(
      (element) => element.type === 'text' && element.text === 'Centered expansion',
    );
    const inheritedCenteredElement = elements.find(
      (element) => element.type === 'text' && element.text === 'Inherited centered',
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
      x: 205,
      y: 196,
      width: 742,
      height: 93,
      align: 'center',
      fontFamily: 'Arial',
      fontSize: 64,
      fontWeight: 700,
      lineHeight: 1.05,
    });
    expect(authorElement).toBeUndefined();
    expect(project.pages[0]?.layoutId).toBe('pptx-layout-slideLayout1');
    const importedLayout = project.slideLayouts?.['pptx-layout-slideLayout1'];
    expect(importedLayout).toMatchObject({
      id: 'pptx-layout-slideLayout1',
      name: 'Statement',
      placeholderVisibility: {
        body: true,
        footer: true,
        slideNumber: true,
        title: true,
      },
    });
    expect(importedLayout?.placeholderRoles).toEqual(expect.arrayContaining(['title']));
    const unusedLayout = project.slideLayouts?.['pptx-layout-slideLayout2'];
    expect(unusedLayout).toMatchObject({
      id: 'pptx-layout-slideLayout2',
      name: 'Title & Photo',
    });
    expect(unusedLayout?.placeholderRoles).toEqual(expect.arrayContaining(['title']));
    expect(importedLayout?.elementIds).toEqual(
      expect.arrayContaining([
        'pptx-layout-slideLayout1-layout-image-20',
        'pptx-layout-slideLayout1-layout-text-22',
        'pptx-layout-slideLayout1-layout-text-21',
      ]),
    );
    expect(importedLayout?.elements['pptx-layout-slideLayout1-layout-image-20']).toMatchObject({
      templateSource: { layoutId: 'pptx-layout-slideLayout1', type: 'layout' },
      type: 'image',
    });
    expect(importedLayout?.elements['pptx-layout-slideLayout1-layout-text-22']).toMatchObject({
      templateSource: { layoutId: 'pptx-layout-slideLayout1', type: 'layout' },
      text: 'Erick Wendel',
      type: 'text',
    });
    expect(importedLayout?.elements['pptx-layout-slideLayout1-layout-text-21']).toMatchObject({
      placeholderRole: 'title',
      templateSource: { layoutId: 'pptx-layout-slideLayout1', type: 'layout' },
      text: 'Title Text',
      type: 'text',
    });
    expect(defaultSizedElement).toMatchObject({
      fontSize: 160,
      fontWeight: 700,
      text: 'Default sized',
      type: 'text',
    });
    if (!centeredElement || centeredElement.type !== 'text') throw new Error('Expected centered text.');
    expect(centeredElement.align).toBe('center');
    expect(centeredElement.x + centeredElement.width / 2).toBeCloseTo(672, 0);
    expect(centeredElement.y + centeredElement.height / 2).toBeCloseTo(864, 0);
    if (!inheritedCenteredElement || inheritedCenteredElement.type !== 'text') {
      throw new Error('Expected inherited centered text.');
    }
    expect(inheritedCenteredElement.align).toBe('center');
    expect(project.pages[0]?.elementIds.some((elementId) => elementId.includes('placeholder'))).toBe(false);
    expect(imageElements).toHaveLength(1);
    expect(imageElement).toMatchObject({ locked: false, type: 'image' });
    expect(videoElement).toMatchObject({
      autoplayInPreview: true,
      controls: true,
      locked: false,
      startOnClick: true,
      type: 'video',
    });

    const videoAsset = Object.values(project.assets).find((asset) => asset.fileName === 'media1.mp4');
    expect(imageAsset?.mimeType).toBe('image/png');
    expect(layoutImageAsset?.mimeType).toBe('image/png');
    expect(videoAsset?.mimeType).toBe('video/mp4');
  });

  it('imports PowerPoint video media calls that start after the slide transition', async () => {
    const service = new BrowserPptxImportService();
    const project = await service.importPowerPoint({
      file: createPptxFixture(
        slideXml
          .replace(
            '<p:cTn id="4" nodeType="clickEffect" presetClass="mediacall">',
            '<p:cTn id="4" nodeType="afterEffect" presetClass="mediacall">',
          )
          .replace('<p:spTgt spid="2"/>', '<p:spTgt spid="200"/>')
          .replace('<p:spTgt spid="3"/>', '<p:spTgt spid="300"/>')
          .replace('<p:bldP spid="3"/>', '<p:bldP spid="300"/>')
          .replace('<p:bldP spid="2"/>', '<p:bldP spid="200"/>'),
      ),
    });
    const videoElement = Object.values(project.elements).find(
      (element) => element.type === 'video',
    );

    expect(project.pages[0]?.animationBuilds?.at(-1)).toMatchObject({
      elementId: 'pptx-page-1-slide-video-4',
      mediaAction: 'play',
      trigger: 'after-transition',
    });
    expect(videoElement).toMatchObject({
      autoplayInPreview: true,
      startOnClick: false,
      type: 'video',
    });
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

  it('uses OPC relationships, content types, theme colors, shapes, groups, tables, and import warnings', async () => {
    const service = new BrowserPptxImportService();
    const project = await service.importPowerPoint({ file: createStandardsFixture() });

    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]?.background).toEqual({ type: 'color', color: '#FF9900' });

    const elements = Object.values(project.elements);
    const themeShape = elements.find((element) => element.type === 'shape' && element.id.includes('shape-10'));
    const groupedShape = elements.find((element) => element.type === 'shape' && element.id.includes('shape-21'));
    const imageAsset = Object.values(project.assets).find((asset) => asset.fileName === 'photo.dat');
    const tableTexts = elements
      .filter((element) => element.type === 'text')
      .filter((element) => ['Cell A', 'Cell B'].includes(element.text))
      .map((element) => element.text)
      .sort();

    expect(themeShape).toMatchObject({
      type: 'shape',
      shape: 'rounded-rect',
      fill: '#FF9900',
      stroke: '#111111',
      strokeWidth: 5,
      rotation: 90,
    });
    expect(groupedShape).toMatchObject({
      type: 'shape',
      shape: 'diamond',
      fill: '#00AA66',
      x: 384,
      y: 192,
    });
    expect(tableTexts).toEqual(['Cell A', 'Cell B']);
    expect(imageAsset).toMatchObject({ fileName: 'photo.dat', mimeType: 'image/png', type: 'image' });
    expect(project.importWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'pptx-external-relationship', severity: 'warning' }),
        expect.objectContaining({ code: 'pptx-unsupported-chart', severity: 'info' }),
      ]),
    );
  });
});
