import { BrainCircuit, Eraser, FileUp, FolderOpen, ImagePlus, Languages, Sparkles } from 'lucide-react';

export const workflowSteps = [
  {
    id: 'pptx',
    icon: FileUp,
    title: 'Import existing presentations',
    copy: 'Google Slides? Keynote? Export as .pptx and import into LocalStudio.',
  },
  {
    id: 'prompt',
    icon: BrainCircuit,
    title: 'Prompt-to-slide',
    copy: 'A prompt becomes editable slide layers, not a flat generated image.',
  },
  {
    id: 'image',
    icon: ImagePlus,
    title: 'Prompt-to-image',
    copy: 'A prompt becomes an image asset while you keep composing the same slide.',
  },
  {
    id: 'translate',
    icon: Languages,
    title: 'Translate',
    copy: 'Translate selected text, one page, or the full deck in place.',
  },
  {
    id: 'edit',
    icon: Eraser,
    title: 'Edit images',
    copy: 'Remove the background, then flip or expand the image as a normal layer.',
  },
  {
    id: 'local',
    icon: FolderOpen,
    title: 'Work locally',
    copy: 'Save project files to disk and restore from local version history.',
  },
  {
    id: 'webai',
    icon: Sparkles,
    title: 'Powered by Web AI',
    copy: 'Browser-native AI capabilities keep the workflow fast, private, and local-first.',
  },
] as const;
