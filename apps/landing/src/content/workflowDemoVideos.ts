export const workflowDemoVideos = {
  pptx: {
    kind: 'video',
    src: '/demo-bring-your-ppt.mp4',
    fallbackSrc: '/demo-bring-your-ppt.gif',
    posterSrc: '/bring-your-own-ppt-showcase-645.webp',
    label: 'Bring your own PPT workflow importing an existing presentation into LocalStudio',
  },
  prompt: {
    kind: 'video',
    src: '/demo-prompt-to-slides.mp4',
    fallbackSrc: '/demo-prompt-to-slides.gif',
    posterSrc: '/prompt-to-slide-showcase-645.webp',
    label: 'Prompt-to-slide workflow generating an editable presentation in LocalStudio',
  },
  image: {
    kind: 'video',
    src: '/demo-prompt-to-image.mp4',
    fallbackSrc: '/demo-prompt-to-image.gif',
    posterSrc: '/prompt-to-image-showcase-645.webp',
    label: 'Prompt-to-image workflow generating an image and continuing the slide in LocalStudio',
  },
  translate: {
    kind: 'video',
    src: '/demo-translate.mp4',
    fallbackSrc: '/demo-translate.gif',
    posterSrc: '/translate-showcase-editor-645.webp',
    label: 'Translate workflow updating slide text in LocalStudio',
  },
  local: {
    kind: 'video',
    src: '/demo-work-locally.mp4',
    fallbackSrc: '/demo-work-locally.gif',
    posterSrc: '/project-history-showcase-645.webp',
    label:
      'Work locally workflow saving with the File System Access API and browsing project history in LocalStudio',
  },
  present: {
    kind: 'video',
    src: '/demo-present-with-confidence.mp4',
    fallbackSrc: '/demo-present-with-confidence.gif',
    posterSrc: '/present-with-confidence-showcase-645.webp',
    label: 'Present with confidence workflow running a LocalStudio deck in presenter mode',
  },
  share: {
    kind: 'video',
    src: '/demo-share-presentation.mp4',
    fallbackSrc: '/demo-share-presentation.gif',
    posterSrc: '/webmcp-showcase-645.webp',
    label: 'Share presentation workflow publishing a portable LocalStudio deck preview',
  },
} as const;
