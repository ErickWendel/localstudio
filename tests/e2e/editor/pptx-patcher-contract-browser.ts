import { type PptxPatcherContractInput } from './pptx-patcher-contract-fixtures';

export type PptxPatcherContractResult = {
  bufferBytes: number;
  warningCodes: string[];
};

export async function evaluatePptxPatcherContract({
  base64,
  pages,
  patchPages,
  warnings,
}: PptxPatcherContractInput): Promise<PptxPatcherContractResult> {
  const { pptxPackagePatcher } = (await import(
    '/editor/src/services/exporting/pptxPackagePatcher.ts'
  )) as typeof import('../../../apps/editor/src/services/exporting/pptxPackagePatcher');
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const patched = pptxPackagePatcher.patchPackageBuffer(
    bytes.buffer,
    pages,
    warnings,
    patchPages,
  );

  return {
    bufferBytes: patched.buffer.byteLength,
    warningCodes: patched.warnings.map((warning) => warning.code).sort(),
  };
}
