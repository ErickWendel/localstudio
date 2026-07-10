import type { LanguageDetectionResult } from './transformersRuntimeTypes';

type TextClassificationResult = { label?: unknown; score?: unknown };

function extractTextFromGeneratedValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const values = value as unknown[];
    const lastMessage = values.at(-1);
    if (lastMessage && typeof lastMessage === 'object') {
      const content = (lastMessage as { content?: unknown }).content;
      if (typeof content === 'string') return content;
      const generatedText = (lastMessage as { generated_text?: unknown }).generated_text;
      const nestedText = extractTextFromGeneratedValue(generatedText);
      if (nestedText) return nestedText;
    }

    const firstMessage = values[0];
    if (firstMessage && typeof firstMessage === 'object') {
      const generatedText = (firstMessage as { generated_text?: unknown }).generated_text;
      const nestedText = extractTextFromGeneratedValue(generatedText);
      if (nestedText) return nestedText;
    }
  }
  if (value && typeof value === 'object' && 'generated_text' in value) {
    return extractTextFromGeneratedValue((value as { generated_text?: unknown }).generated_text);
  }
  return undefined;
}

function extractGeneratedText(result: unknown) {
  if (typeof result === 'string') return result;
  const generatedText = extractTextFromGeneratedValue(result);
  if (generatedText) return generatedText;
  throw new Error('WebGPU text generation did not return text.');
}

function isTextClassificationResult(value: unknown): value is TextClassificationResult {
  return Boolean(value && typeof value === 'object');
}

function getTopClassificationResult(result: unknown): TextClassificationResult | undefined {
  if (Array.isArray(result)) {
    const values: unknown[] = result;
    const first = values[0];
    if (Array.isArray(first)) return getTopClassificationResult(first);
    return isTextClassificationResult(first) ? first : undefined;
  }
  return isTextClassificationResult(result) ? result : undefined;
}

function extractDetectedLanguage(result: unknown): LanguageDetectionResult {
  const topResult = getTopClassificationResult(result);
  const label = topResult?.label;
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error('Language detection model did not return a language label.');
  }

  return {
    language: label,
    ...(typeof topResult?.score === 'number' ? { score: topResult.score } : {}),
  };
}

export const transformersResultParsing = {
  extractGeneratedText,
  extractDetectedLanguage,
};
