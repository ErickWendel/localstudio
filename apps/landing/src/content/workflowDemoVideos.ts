export const workflowDemoVideos = {
  prompt: {
    src: '/prompt-to-slide.mp4',
    fallbackSrc: '/prompt-to-slide.gif',
    label: 'Prompt-to-slide workflow generating an editable presentation in LocalStudio',
  },
  image: {
    src: '/prompt-to-image.mp4',
    fallbackSrc: '/prompt-to-image.gif',
    label: 'Prompt-to-image workflow generating an image and continuing the slide in LocalStudio',
  },
  translate: {
    src: '/translate.mp4',
    fallbackSrc: '/translate.gif',
    label: 'Translate workflow updating slide text in LocalStudio',
  },
  edit: {
    src: '/edit-images.mp4',
    fallbackSrc: '/edit-images.gif',
    label: 'Edit images workflow removing backgrounds and adjusting image layers in LocalStudio',
  },
  local: {
    src: '/fs-history.mp4',
    fallbackSrc: '/fs-history.gif',
    label: 'Work locally workflow saving with the File System Access API and browsing project history in LocalStudio',
  },
  webai: {
    src: '/powered-webau.mp4',
    fallbackSrc: '/powered-webau.gif',
    label: 'Powered by Web AI workflow showing browser-native AI capabilities in LocalStudio',
  },
} as const;
