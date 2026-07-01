import { AppWindow, HardDrive } from 'lucide-react';

export const requirements = [
  {
    icon: AppWindow,
    title: 'Chrome browser',
    copy: 'Preferred browser because LocalStudio uses Chrome-first browser AI and file system APIs as they become available.',
  },
  {
    icon: HardDrive,
    title: '10GB free storage',
    copy: 'Recommended minimum for downloaded model weights, browser-managed caches, generated assets, and local project history.',
  },
] as const;
