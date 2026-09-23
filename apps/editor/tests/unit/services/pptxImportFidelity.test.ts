import { describe, expect, it, vi } from 'vitest';
import { BrowserPptxImportService } from '../../../src/services/importing/pptx/pptxImportService';
import { pptxImportFidelity } from '../../../src/services/importing/pptx/pptxImportFidelity';
import { pptxPackage } from '../../../src/services/importing/pptx/pptxPackage';
import { pptxZip } from '../../../src/services/importing/pptx/pptxZip';
import { createStoredPptxFile } from './pptxTestZip';

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:localstudio-test'),
});

function bigEndianTiff() {
  const tags = [
    [256, 4, 1, 1],
    [257, 4, 1, 1],
    [258, 3, 1, 8],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [273, 4, 1, 122],
    [277, 3, 1, 3],
    [278, 4, 1, 1],
    [279, 4, 1, 3],
  ] as const;
  const bytes = [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, tags.length];
  for (const [tag, type, count, value] of tags) {
    bytes.push((tag >> 8) & 0xff, tag & 0xff, (type >> 8) & 0xff, type & 0xff);
    const valueBytes =
      type === 3
        ? [(value >> 8) & 0xff, value & 0xff, 0, 0]
        : [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
    bytes.push(0, 0, 0, count, ...valueBytes);
  }
  bytes.push(0, 0, 0, 0, 12, 34, 56);
  return new Uint8Array(bytes);
}

function createProtocolFixture() {
  const slide = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Readable streams</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:pic>
      <p:nvPicPr><p:cNvPr id="3" name="Clip"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rIdTiff"/></p:blipFill>
      <p:spPr>
        <a:xfrm><a:off x="0" y="457200"/><a:ext cx="914400" cy="457200"/></a:xfrm>
        <a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>
          <a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="50" y="0"/></a:moveTo><a:cubicBezTo><a:pt x="80" y="0"/><a:pt x="100" y="20"/><a:pt x="100" y="50"/></a:cubicBezTo><a:close/></a:path></a:pathLst>
        </a:custGeom>
      </p:spPr>
    </p:pic>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="4" name="Connector"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr>
        <a:xfrm><a:off x="914400" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm>
        <a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>
          <a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:cubicBezTo><a:pt x="30" y="0"/><a:pt x="70" y="100"/><a:pt x="100" y="100"/></a:cubicBezTo></a:path></a:pathLst>
        </a:custGeom>
        <a:ln w="12700"><a:solidFill><a:srgbClr val="111111"/></a:solidFill></a:ln>
      </p:spPr>
    </p:sp>
    <p:pic>
      <p:nvPicPr><p:cNvPr id="5" name="Movie"/><p:cNvPicPr/><p:nvPr><a:videoFile r:link="rIdVideo"/></p:nvPr></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rIdPoster"/></p:blipFill>
      <p:spPr><a:xfrm><a:off x="0" y="914400"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>
    </p:pic>
  </p:spTree></p:cSld>
</p:sld>`;
  const layout = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="9" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr cap="all"/></a:lvl1pPr></a:lstStyle><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sldLayout>`;
  return createStoredPptxFile([
    {
      path: 'ppt/presentation.xml',
      contents:
        '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldSz cx="9144000" cy="5143500"/><p:sldIdLst><p:sldId id="1" r:id="rId1"/></p:sldIdLst></p:presentation>',
    },
    {
      path: 'ppt/_rels/presentation.xml.rels',
      contents:
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    },
    { path: 'ppt/slides/slide1.xml', contents: slide },
    {
      path: 'ppt/slides/_rels/slide1.xml.rels',
      contents:
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rIdTiff" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/photo.tif"/><Relationship Id="rIdPoster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/poster.png"/><Relationship Id="rIdVideo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="../media/clip.mp4"/></Relationships>',
    },
    { path: 'ppt/slideLayouts/slideLayout1.xml', contents: layout },
    { path: 'ppt/media/photo.tif', contents: bigEndianTiff() },
    { path: 'ppt/media/poster.png', contents: new Uint8Array([137, 80, 78, 71]) },
    { path: 'ppt/media/clip.mp4', contents: new Uint8Array([0, 0, 0, 24]) },
    {
      path: '[Content_Types].xml',
      contents:
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="tif" ContentType="image/tiff"/><Default Extension="png" ContentType="image/png"/><Default Extension="mp4" ContentType="video/mp4"/></Types>',
    },
  ]);
}

describe('PowerPoint import fidelity protocol', () => {
  it('keeps posters, custom geometry, converted TIFF, and capitalized title text', async () => {
    const file = createProtocolFixture();
    const packageDocument = await pptxPackage.create(await pptxZip.readPackage(file));
    const project = await new BrowserPptxImportService().importPowerPoint({ file });
    const report = await pptxImportFidelity.audit(packageDocument, project);
    const image = Object.values(project.elements).find((element) => element.type === 'image');
    const line = Object.values(project.elements).find((element) => element.type === 'shape');
    const video = Object.values(project.elements).find((element) => element.type === 'video');
    const title = Object.values(project.elements).find((element) => element.type === 'text');

    expect(report.gaps).toEqual([]);
    expect(image?.type).toBe('image');
    expect(image?.type === 'image' ? image.clipPath?.length : 0).toBeGreaterThan(0);
    expect(project.assets[image && image.type === 'image' ? image.assetId : '']?.mimeType).toBe('image/png');
    expect(line).toMatchObject({ path: { kind: 'bezier' }, shape: 'line', type: 'shape' });
    expect(video).toMatchObject({ type: 'video' });
    expect(project.assets[video && video.type === 'video' ? video.posterAssetId ?? '' : '']?.fileName).toBe(
      'poster.png',
    );
    expect(title).toMatchObject({ text: 'READABLE STREAMS', type: 'text' });
  });
});
