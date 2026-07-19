export type TranscriptionModelPresetId = 'whisper-base';

export interface TranscriptionModelPreset {
  description: string;
  dtype?: 'fp16' | 'q4' | 'q8';
  id: TranscriptionModelPresetId;
  label: string;
  modelId: string;
}

export type TranscriptEmbeddingPresetId = 'default-minilm';

export interface TranscriptEmbeddingPreset {
  id: TranscriptEmbeddingPresetId;
  label: string;
  modelId: string;
}

const transcriptionPresets: TranscriptionModelPreset[] = [
  {
    id: 'whisper-base',
    label: 'Whisper Base',
    description: 'Multilingual WebGPU captions for live presenter mode.',
    dtype: 'q4',
    modelId: 'onnx-community/whisper-base',
  },
];

const embeddingPresets: TranscriptEmbeddingPreset[] = [
  {
    id: 'default-minilm',
    label: 'MiniLM transcript search',
    modelId: 'onnx-community/all-MiniLM-L6-v2-ONNX',
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
