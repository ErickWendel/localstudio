export const slidePromptExamples = [
  'Slide with the placeholder image expanded large on the left, the neon green title “AI Design Revolution” on the right, and the subtitle “Browser-native creative” below it.',
  'Three-image grid about Web AI, with matching captions.',
  'Top title and three body bullets about why Web AI is useful.',
  'Slide using https://img-c.udemycdn.com/course/480x270/5625134_794c.jpg as the main image, with a short title and caption.',
  'Slide with a deep purple background, gold title "Web AI Advantage", and white subtitle "Fast local intelligence".',
] as const;

export const imagePromptExamples = [
  'Create an icy Bonsai tree in a rainy forest with snowy mountains in the background, photo realistic',
  'Create a neon green browser-native design studio floating inside a dark futuristic workspace',
  'Create a cinematic close-up of a laptop editing slides with glowing green UI reflections',
  'Create a realistic product hero image for a local-first AI creative editor on a dark background',
  'Create a cyberpunk classroom with holographic slide canvases and black-and-green lighting',
] as const;

export const promptRecipeCatalog = {
  slide: {
    label: 'Slide prompt examples',
    examples: slidePromptExamples,
  },
  image: {
    label: 'Image prompt examples',
    examples: imagePromptExamples,
  },
} as const;
