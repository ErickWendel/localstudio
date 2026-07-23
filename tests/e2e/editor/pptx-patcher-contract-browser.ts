import { type PptxPatcherContractInput } from './pptx-patcher-contract-fixtures';

export type PptxPatcherContractResult = {
  bufferBytes: number;
  slideXml: string;
  warningCodes: string[];
};

export async function evaluatePptxPatcherContract({
  base64,
  packageMutations,
  pages,
  patchPages,
  warnings,
}: PptxPatcherContractInput): Promise<PptxPatcherContractResult> {
  const { strFromU8, strToU8, unzipSync, zipSync } = (await import(
    '/@fs/Users/erickwendel/.codex/worktrees/77ff/canva-webai-clone/node_modules/fflate/esm/browser.js'
  )) as typeof import('fflate');
  const { pptxPackagePatcher } = (await import(
    '/editor/src/services/exporting/pptxPackagePatcher.ts'
  )) as typeof import('../../../apps/editor/src/services/exporting/pptxPackagePatcher');
  let bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  if (packageMutations) {
    const files = unzipSync(bytes);
    if (packageMutations.removePresentationFile) {
      delete files['ppt/presentation.xml'];
    }
    if (packageMutations.removeContentTypesFile) {
      delete files['[Content_Types].xml'];
    }
    if (packageMutations.removeImageMedia) {
      delete files['ppt/media/image1.png'];
    }
    if (packageMutations.addExistingCropRect) {
      const slidePath = 'ppt/slides/slide1.xml';
      files[slidePath] = strToU8(
        strFromU8(files[slidePath] ?? new Uint8Array()).replace(
          '<a:blip r:embed="rId1"/>',
          '<a:blip r:embed="rId1"/><a:srcRect l="1" t="2" r="3" b="4"/>',
        ),
      );
    }
    if (packageMutations.removeSlideShapeIds) {
      const slidePath = 'ppt/slides/slide1.xml';
      files[slidePath] = strToU8(
        strFromU8(files[slidePath] ?? new Uint8Array()).replaceAll('<p:cNvPr', '<p:removedNvPr'),
      );
    }
    if (packageMutations.addUndeclaredAviMedia) {
      files['ppt/media/video2.avi'] = new Uint8Array([7, 8, 9]);
      files['ppt/slides/_rels/slide1.xml.rels'] = strToU8(
        strFromU8(files['ppt/slides/_rels/slide1.xml.rels'] ?? new Uint8Array()).replace(
          '</Relationships>',
          '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="../media/video2.avi"/></Relationships>',
        ),
      );
    }
    if (packageMutations.addAbsoluteMissingMediaRelationship) {
      files['ppt/slides/_rels/slide1.xml.rels'] = strToU8(
        strFromU8(files['ppt/slides/_rels/slide1.xml.rels'] ?? new Uint8Array()).replace(
          '</Relationships>',
          '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="/ppt/media/missing.mov"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="https://cdn.example.test/video.mp4"/></Relationships>',
        ),
      );
    }
    bytes = zipSync(files);
  }
  const patched = pptxPackagePatcher.patchPackageBuffer(
    bytes.buffer,
    pages,
    warnings,
    patchPages,
  );
  const files = unzipSync(new Uint8Array(patched.buffer));

  return {
    bufferBytes: patched.buffer.byteLength,
    slideXml: strFromU8(files['ppt/slides/slide1.xml'] ?? new Uint8Array()),
    warningCodes: patched.warnings.map((warning) => warning.code).sort(),
  };
}
