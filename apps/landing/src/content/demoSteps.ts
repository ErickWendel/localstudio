import { BrainCircuit, Eraser, FolderOpen, ImagePlus, Languages } from 'lucide-react';

export const demoSteps = [
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
    title: 'Remove backgrounds',
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
] as const;
