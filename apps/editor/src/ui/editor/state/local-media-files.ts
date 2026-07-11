import { localMediaImportConfig } from '../media/localMediaImportConfig';

type MediaAssetType = 'gif' | 'image' | 'video';
type MediaSize = { height: number; width: number };
type VideoSize = MediaSize & { durationSeconds?: number };

function getFileExtension(fileName: string) {
  const extension = fileName.trim().toLowerCase().split('.').pop();
  return extension && extension !== fileName.toLowerCase() ? extension : '';
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Image file could not be read as a data URL.'));
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Image file could not be read.'));
    });
    reader.readAsDataURL(file);
  });
}

function readImageSize(src: string) {
  return new Promise<MediaSize>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener('error', () => {
      reject(new Error('Image dimensions could not be read.'));
    });
    image.src = src;
  });
}

function readVideoSize(src: string) {
  return new Promise<VideoSize>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => {
      resolve({
        ...(Number.isFinite(video.duration) && video.duration > 0
          ? { durationSeconds: video.duration }
          : {}),
        height: video.videoHeight || 9,
        width: video.videoWidth || 16,
      });
    });
    video.addEventListener('error', () => {
      reject(new Error('Video dimensions could not be read.'));
    });
    video.src = src;
  });
}

function isSupportedLocalVideoFile(file: File) {
  const extension = getFileExtension(file.name);
  return (
    localMediaImportConfig.supportedVideoMimeTypes.has(file.type) ||
    localMediaImportConfig.supportedVideoExtensions.has(extension)
  );
}

function createMediaObjectUrl(file: File) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('This browser cannot import video files from disk.');
  }
  return URL.createObjectURL(file);
}

function getMediaAssetType(file: File): MediaAssetType {
  const extension = getFileExtension(file.name);
  if (file.type === 'image/gif') return 'gif';
  if (file.type.startsWith('video/') || localMediaImportConfig.localVideoExtensions.has(extension)) {
    return 'video';
  }
  return 'image';
}

export const localMediaFiles = {
  createMediaObjectUrl,
  getMediaAssetType,
  isSupportedLocalVideoFile,
  readImageFileAsDataUrl,
  readImageSize,
  readVideoSize,
};
