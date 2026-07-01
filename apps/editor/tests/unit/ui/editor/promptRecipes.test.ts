import { promptRecipes } from '../../../../src/ui/editor/prompting/promptRecipes';

describe('promptRecipes', () => {
  it('shares the prompt examples used by UI and WebMCP metadata', () => {
    const contrastedImagePrompts = [
      'A realistic photo of a person using an AI-powered web app on a tablet in a modern city environment, glass buildings and people blurred in the background, subject positioned on the left, camera at eye level, natural daylight, urban innovation and technology atmosphere',
      'A stunning futuristic AI background featuring glowing neural network structures floating in a dark digital space, abstract data particles flowing between nodes, deep perspective, layered depth, cinematic blue and purple lighting, highly detailed, realistic, professional technology aesthetic, no people, no logos, no readable text',
      'A beautiful abstract machine learning landscape with mountains made of glowing data points, neural network pathways forming rivers of light, dark futuristic sky, deep depth of field, cinematic atmosphere, elegant blue and cyan color palette, realistic 3D technology background, no people, no logos, no readable text',
      'A macro cinematic background of an advanced AI chip on a circuit board, glowing neural network patterns flowing across the surface, shallow depth of field, futuristic blue and gold lighting, extremely detailed hardware texture, premium technology photography style, no logos, no readable text',
      'A cinematic AI agent background showing multiple autonomous digital agents as glowing abstract orbs moving through a connected web of tasks, browser panels, APIs, and data pipelines, futuristic dark environment, strong sense of motion, deep perspective, premium technology style, no people, no logos, no readable text',
    ];

    expect(promptRecipes.slidePromptExamples).toContain('Three-image grid about Web AI, with matching captions.');
    expect(promptRecipes.imagePromptExamples).toEqual(contrastedImagePrompts);
    expect(promptRecipes.promptRecipeCatalog.slide.examples).toBe(promptRecipes.slidePromptExamples);
    expect(promptRecipes.promptRecipeCatalog.image.examples).toBe(promptRecipes.imagePromptExamples);
  });
});
