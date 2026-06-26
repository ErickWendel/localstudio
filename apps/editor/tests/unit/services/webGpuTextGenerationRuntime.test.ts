import { describe, expect, it } from 'vitest';
import { extractGeneratedText } from '../../../src/services/webGpuTextGenerationRuntime';

describe('extractGeneratedText', () => {
  it('extracts plain generated text responses', () => {
    expect(extractGeneratedText([{ generated_text: 'hello' }])).toBe('hello');
  });

  it('extracts the last assistant content from chat-style generated text responses', () => {
    expect(
      extractGeneratedText([
        {
          generated_text: [
            { role: 'user', content: { text: 'hello' } },
            { role: 'assistant', content: 'olá' },
          ],
        },
      ]),
    ).toBe('olá');
  });
});
