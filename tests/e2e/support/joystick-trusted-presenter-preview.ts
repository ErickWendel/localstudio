import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';

import { createTrustedPresenterPreviewGif } from './joystick-trusted-presenter-preview-gif';
import { createTrustedPresenterPreviewImage } from './joystick-trusted-presenter-preview-image';
import { createTrustedPresenterPreviewImageUrl } from './joystick-trusted-presenter-preview-image-url';
import { createTrustedPresenterPreviewMissingMedia } from './joystick-trusted-presenter-preview-missing-media';
import { createTrustedPresenterPreviewShape } from './joystick-trusted-presenter-preview-shape';
import { createTrustedPresenterPreviewTitle } from './joystick-trusted-presenter-preview-title';
import { createTrustedPresenterPreviewVideo } from './joystick-trusted-presenter-preview-video';

export const joystickTrustedPresenterPreview = {
  create(label: string, backgroundColor: string): PresenterRemoteSlidePreview {
    const imageUrl = createTrustedPresenterPreviewImageUrl(label, backgroundColor);
    return {
      backgroundColor,
      backgroundImageUrl: imageUrl,
      elements: [
        createTrustedPresenterPreviewImage(label, imageUrl),
        createTrustedPresenterPreviewTitle(label),
        createTrustedPresenterPreviewShape(label),
        createTrustedPresenterPreviewGif(label, imageUrl),
        createTrustedPresenterPreviewVideo(label, imageUrl),
        createTrustedPresenterPreviewMissingMedia(label),
      ],
      height: 1080,
      width: 1920,
    };
  },
};
