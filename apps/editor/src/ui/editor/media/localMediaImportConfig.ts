const supportedVideoExtensions = new Set(['mp4', 'webm']);
const supportedVideoMimeTypes = new Set(['video/mp4', 'video/webm']);

export const localMediaImportConfig = {
  accept: 'image/*,video/*',
  localVideoExtensions: new Set(['mp4', 'webm', 'mov']),
  supportedVideoExtensions,
  supportedVideoMimeTypes,
  videoReplaceAccept: [
    ...supportedVideoMimeTypes,
    ...[...supportedVideoExtensions].map((extension) => `.${extension}`),
  ].join(','),
};
