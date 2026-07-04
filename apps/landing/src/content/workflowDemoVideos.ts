export const workflowDemoVideos = {
  pptx: {
    kind: 'image',
    src: '/powerpoint-import.gif',
    label: 'PowerPoint (.pptx) import workflow bringing an existing presentation into LocalStudio',
  },
  prompt: {
    kind: 'video',
    src: '/prompt-to-slide.mp4',
    fallbackSrc: '/prompt-to-slide.gif',
    label: 'Prompt-to-slide workflow generating an editable presentation in LocalStudio',
  },
  image: {
    kind: 'video',
    src: '/prompt-to-image.mp4',
    fallbackSrc: '/prompt-to-image.gif',
    label: 'Prompt-to-image workflow generating an image and continuing the slide in LocalStudio',
  },
  translate: {
    kind: 'video',
    src: '/translate.mp4',
    fallbackSrc: '/translate.gif',
    label: 'Translate workflow updating slide text in LocalStudio',
  },
  edit: {
    kind: 'video',
    src: '/edit-images.mp4',
    fallbackSrc: '/edit-images.gif',
    label: 'Edit images workflow removing backgrounds and adjusting image layers in LocalStudio',
  },
  local: {
    kind: 'video',
    src: '/fs-history.mp4',
    fallbackSrc: '/fs-history.gif',
    label: 'Work locally workflow saving with the File System Access API and browsing project history in LocalStudio',
  },
  webai: {
    kind: 'video',
    src: '/powered-webau.mp4',
    fallbackSrc: '/powered-webau.gif',
    label: 'Powered by Web AI workflow showing browser-native AI capabilities in LocalStudio',
  },
} as const;
