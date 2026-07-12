export interface PptxPackageFile {
  path: string;
  blob: Blob;
  imageSize?: PptxImageSize;
}

export interface PptxImageSize {
  height: number;
  width: number;
}

export type PptxImportInput = { file: File };
