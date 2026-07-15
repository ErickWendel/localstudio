export const featureShowcases = [
  {
    id: 'pptx',
    eyebrow: 'PowerPoint (.pptx)',
    title: 'Bring your existing presentations to LocalStudio.',
    copy: 'Google Slides? Keynote? Export as .pptx and import into LocalStudio. Your existing presentation becomes the starting point for a local, editable deck.',
    bullets: [
      'Import .pptx files from the editor',
      'Turn existing decks into editable projects',
      'Keep refining with local AI workflows',
    ],
  },
  {
    id: 'presenter',
    eyebrow: 'Presenter mode',
    title: 'Present with confidence from LocalStudio.',
    copy: 'Presenter mode gives speakers a dedicated view with timer, notes, and slide controls, while a companion PWA can remotely control the presentation over peer-to-peer browser connections.',
    bullets: [
      'Speaker timer and notes',
      'Next and previous slide controls',
      'PWA remote control over P2P',
      'Fullscreen presenter playback',
    ],
  },
  {
    id: 'prompt',
    eyebrow: 'Prompt-to-slide',
    title: 'Generate a real slide structure, then keep editing every layer.',
    copy: 'The prompt flow creates editable text, image, and shape layers on the active page instead of locking the result into one flat bitmap.',
    bullets: [
      'Structured JSON slide tasks',
      'Progressive layer updates',
      'Konva-ready editable objects',
    ],
  },
  {
    id: 'image',
    eyebrow: 'Prompt-to-image',
    title: 'Create image assets without leaving the deck.',
    copy: 'Prompt-to-image is part of the same prompt surface, so a generated asset lands back on the canvas as a normal editable layer.',
    bullets: [
      'Image prompts inside the prompt bar',
      'Size, steps, and seed controls',
      'Generated assets saved locally',
    ],
  },
  {
    id: 'translate',
    eyebrow: 'Translate',
    title: 'Translate selected text, the current page, or the whole deck.',
    copy: 'Translation stays inside the editor context with target-language setup and layout-preserving text updates.',
    bullets: [
      'Target language control',
      'Language detection',
      'Selected text, page, or deck scopes',
    ],
  },
  {
    id: 'local',
    eyebrow: 'Work locally',
    title: 'Project files, assets, and history stay in a folder you control.',
    copy: 'The editor is local-first: project JSON, assets, cache, and version snapshots live on disk while model weights stay in browser-managed caches.',
    bullets: [
      'File System Access API',
      'Local version history',
      'No account or cloud workspace required',
    ],
  },
  {
    id: 's3',
    eyebrow: 'S3-compatible mirror',
    title: 'S3-compatible projects can still publish public links.',
    copy: 'MinIO works as the local/self-hosted example, while the same project mirror shape fits AWS S3, R2, or any compatible endpoint. You can also mirror local fonts so shared decks keep their typography for viewers.',
    bullets: [
      'Project JSON and assets',
      'Version history and config',
      'Public share payloads with mirrored fonts',
    ],
  },
  {
    id: 'edit',
    eyebrow: 'Edit images',
    title: 'Use segmentation tools like normal editor actions.',
    copy: 'Background removal, flip, and crop sit next to ordinary layer controls so AI image editing feels like part of the canvas.',
    bullets: [
      'Click-guided subject selection',
      'Blue mask preview',
      'Flip and crop after extraction',
    ],
  },
] as const;
