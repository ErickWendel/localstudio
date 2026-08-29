export interface PdfExportPage {
  bytes: Uint8Array;
  heightPoints: number;
  widthPoints: number;
}

export interface PdfExportWorkerRequest {
  pages: PdfExportPage[];
  type: 'create-pdf';
}

export type PdfExportWorkerResponse =
  | { current: number; total: number; type: 'progress' }
  | { bytes: ArrayBuffer; type: 'result' }
  | { message: string; type: 'error' };
