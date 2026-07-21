export type TranscriptEmbeddingPresetId = 'default-minilm';

export interface TranscriptEmbeddingPreset {
  id: TranscriptEmbeddingPresetId;
  label: string;
  modelId: string;
}

const embeddingPresets: TranscriptEmbeddingPreset[] = [
  {
    id: 'default-minilm',
    label: 'MiniLM transcript search',
    modelId: 'onnx-community/all-MiniLM-L6-v2-ONNX',
  },
];

function getEmbeddingPreset(id: string | undefined): TranscriptEmbeddingPreset {
  return embeddingPresets.find((preset) => preset.id === id) ?? embeddingPresets[0]!;
}

export const transcriptionModelCatalog = {
  embeddingPresets,
  getEmbeddingPreset,
};
