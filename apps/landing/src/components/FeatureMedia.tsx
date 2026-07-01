import { type CSSProperties } from 'react';
import { featureMediaImages } from '../content/featureMediaImages';

type FeatureMediaStyle = CSSProperties & { '--feature-media-ratio'?: string };

export function FeatureMedia({ feature }: { feature: keyof typeof featureMediaImages }) {
  const mediaImage = featureMediaImages[feature];
  const mediaImageStyle: FeatureMediaStyle = { '--feature-media-ratio': mediaImage.aspectRatio };

  return (
    <div className="feature-media with-image" data-feature={feature} aria-label={`${feature} feature preview`}>
      <div className="feature-media-canvas" style={mediaImageStyle}>
        <img
          className="feature-media-image"
          src={mediaImage.src}
          alt={mediaImage.alt}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
