import { BrainCircuit, Eraser, FileUp, FolderOpen, ImagePlus, Languages, Share2 } from 'lucide-react';

export const demoSteps = [
  {
    icon: FileUp,
    title: 'Import presentations',
    copy: 'Google Slides? Keynote? Export as .pptx and import into LocalStudio as an editable project.',
    proof: 'PowerPoint (.pptx)',
  },
  {
    icon: BrainCircuit,
    title: 'Prompt to slides',
    copy: 'Turn a plain-language request into Konva-ready slide objects with structured JSON.',
    proof: 'Editable slide layers',
  },
  {
    icon: Languages,
    title: 'Translate the deck',
    copy: 'Translate one text layer, one page, or the whole deck while preserving layout intent.',
    proof: 'In-place text updates',
  },
  {
    icon: Eraser,
    title: 'Edit images',
    copy: 'Click the subject, preview the segment mask, and keep refining before cutting.',
    proof: 'Canvas image action',
  },
  {
    icon: ImagePlus,
    title: 'Create images',
    copy: 'Generate an asset from the prompt bar and drop it directly into the active slide.',
    proof: 'Normal image layer',
  },
  {
    icon: FolderOpen,
    title: 'Save local projects',
    copy: 'Store metadata and assets in a folder you control instead of a remote workspace.',
    proof: 'Local project files',
  },
  {
    icon: Share2,
    title: 'Share your slides',
    copy: 'Use your own external storage to publish stable links or reimport it into different machines.',
    proof: 'Bring your bucket',
  },
] as const;
