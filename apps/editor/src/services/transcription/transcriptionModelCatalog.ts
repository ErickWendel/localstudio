export type TranscriptionModelPresetId =
  | 'balanced-en'
  | 'experimental-live'
  | 'low-latency-en';

export interface TranscriptionModelPreset {
  description: string;
  dtype?: 'fp16' | 'q4' | 'q8';
  experimental?: boolean;
  id: TranscriptionModelPresetId;
  label: string;
  modelId: string;
}

export type TranscriptEmbeddingPresetId = 'default-minilm' | 'fast-webgpu';

export interface TranscriptEmbeddingPreset {
  id: TranscriptEmbeddingPresetId;
  label: string;
  modelId: string;
}

const transcriptionPresets: TranscriptionModelPreset[] = [
  {
    id: 'low-latency-en',
    label: 'Low latency English',
    description: 'Fast English captions for live presenter mode.',
    dtype: 'q4',
    modelId: 'onnx-community/whisper-tiny.en',
  },
  {
    id: 'balanced-en',
    label: 'Balanced English',
    description: 'Higher quality English transcription with a larger Whisper model.',
    dtype: 'q4',
    modelId: 'onnx-community/whisper-base',
  },
  {
    id: 'experimental-live',
    label: 'Experimental live',
    description: 'Moonshine ASR preset for testing lower-latency live speech paths.',
    dtype: 'q4',
    experimental: true,
    modelId: 'onnx-community/moonshine-base-ONNX',
  },
];

const embeddingPresets: TranscriptEmbeddingPreset[] = [
  {
    id: 'default-minilm',
    label: 'MiniLM transcript search',
    modelId: 'onnx-community/all-MiniLM-L6-v2-ONNX',
  },
  {
    id: 'fast-webgpu',
    label: 'Fast WebGPU transcript search',
    modelId: 'mixedbread-ai/mxbai-embed-xsmall-v1',
  },
];

const transcriptQuestionAnsweringModelId = 'onnx-community/gemma-3-270m-ONNX';

function getTranscriptionPreset(id: string | undefined): TranscriptionModelPreset {
  return transcriptionPresets.find((preset) => preset.id === id) ?? transcriptionPresets[0]!;
}

function getEmbeddingPreset(id: string | undefined): TranscriptEmbeddingPreset {
  return embeddingPresets.find((preset) => preset.id === id) ?? embeddingPresets[0]!;
}

export const transcriptionModelCatalog = {
  embeddingPresets,
  getEmbeddingPreset,
  getTranscriptionPreset,
  transcriptQuestionAnsweringModelId,
  transcriptionPresets,
};
