import type { Page } from '../../domain/documents/model';
import type { PresentationExportWarning } from '../contracts/interfaces';
import type { PptxPackagePatchPage } from './pptxPackagePatcher';
import { pptxPackagePatcher } from './pptxPackagePatcher';

interface PptxPatchWorkerRequest {
  buffer: ArrayBuffer;
  id: string;
  patchPages: PptxPackagePatchPage[];
  pages: Page[];
  type: 'patch-pptx-package';
  warnings: PresentationExportWarning[];
}

type PptxPatchWorkerResponse =
  | {
      buffer: ArrayBuffer;
      id: string;
      type: 'result';
      warnings: PresentationExportWarning[];
    }
  | {
      id: string;
      message: string;
      type: 'error';
    };

function postResponse(response: PptxPatchWorkerResponse, transfer?: Transferable[]) {
  if (transfer) {
    self.postMessage(response, { transfer });
    return;
  }
  self.postMessage(response);
}

function isPatchRequest(value: unknown): value is PptxPatchWorkerRequest {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      value.type === 'patch-pptx-package' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'buffer' in value &&
      value.buffer instanceof ArrayBuffer &&
      'pages' in value &&
      Array.isArray(value.pages) &&
      'patchPages' in value &&
      Array.isArray(value.patchPages) &&
      'warnings' in value &&
      Array.isArray(value.warnings),
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isPatchRequest(request)) {
    postResponse({
      id: 'unknown',
      message: 'PPTX patch worker received an invalid request.',
      type: 'error',
    });
    return;
  }
  try {
    const result = pptxPackagePatcher.patchPackageBuffer(
      request.buffer,
      request.pages,
      request.warnings,
      request.patchPages,
    );
    postResponse(
      {
        id: request.id,
        type: 'result',
        ...result,
      },
      [result.buffer],
    );
  } catch (error) {
    postResponse({
      id: request.id,
      message: error instanceof Error ? error.message : 'PPTX patch worker failed.',
      type: 'error',
    });
  }
};
