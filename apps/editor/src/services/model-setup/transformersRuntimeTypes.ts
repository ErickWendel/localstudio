export type TextGenerationInput = string | Array<{ role: string; content: unknown }>;
export type TextGenerationOptions = Record<string, unknown>;

export interface LanguageDetectionResult {
  language: string;
  score?: number | undefined;
}

export interface SamImageInput {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

export interface SamMask {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface SubjectMask {
  data: Uint8Array;
  width: number;
  height: number;
  score: number;
}

export interface SegmentationPoint {
  x: number;
  y: number;
  positive: boolean;
}

export interface BackgroundSegmentationResult {
  imageInput: SamImageInput;
  subjectMask: SubjectMask;
}
