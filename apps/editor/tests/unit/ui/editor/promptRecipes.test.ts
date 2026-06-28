import {
  imagePromptExamples,
  promptRecipeCatalog,
  slidePromptExamples,
} from '../../../../src/ui/editor/promptRecipes';

describe('promptRecipes', () => {
  it('shares the prompt examples used by UI and WebMCP metadata', () => {
    expect(slidePromptExamples).toContain('Three-image grid about Web AI, with matching captions.');
    expect(imagePromptExamples).toContain(
      'Create a neon green browser-native design studio floating inside a dark futuristic workspace',
    );
    expect(promptRecipeCatalog.slide.examples).toBe(slidePromptExamples);
    expect(promptRecipeCatalog.image.examples).toBe(imagePromptExamples);
  });
});
