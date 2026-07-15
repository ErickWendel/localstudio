import {
  BrainCircuit,
  FileUp,
  FolderOpen,
  ImagePlus,
  Languages,
  Presentation,
  Share2,
} from 'lucide-react';

export const workflowSteps = [
  {
    id: 'pptx',
    icon: FileUp,
    title: 'Bring your own PPT',
    copy: 'Import an existing .pptx file and keep refining the deck inside LocalStudio.',
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
    id: 'local',
    icon: FolderOpen,
    title: 'Work locally',
    copy: 'Save project files to disk and restore from local version history.',
  },
  {
    id: 'present',
    icon: Presentation,
    title: 'Present with confidence',
    copy: 'Move from editing to delivery with speaker notes, slide controls, and fullscreen playback.',
  },
  {
    id: 'share',
    icon: Share2,
    title: 'Share your presentation',
    copy: 'Publish a portable share payload and open the same deck from a public preview link.',
  },
] as const;
