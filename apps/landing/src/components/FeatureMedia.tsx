import { type CSSProperties } from 'react';
import { featureMediaImages } from '../content/featureMediaImages';
import { Reveal } from './Reveal';

type FeatureMediaStyle = CSSProperties & { '--feature-media-ratio'?: string };

export function FeatureMedia({ feature }: { feature: keyof typeof featureMediaImages }) {
  const mediaImage = featureMediaImages[feature];
  const mediaImageStyle: FeatureMediaStyle = { '--feature-media-ratio': mediaImage.aspectRatio };

  return (
    <Reveal
      as="div"
      className="feature-media with-image"
      delay={80}
      reveal="showcase-media"
    >
      <div
        className="feature-media-canvas"
        data-feature={feature}
        aria-label={`${feature} feature preview`}
        style={mediaImageStyle}
      >
        <img
          className="feature-media-image"
          src={mediaImage.src}
          alt={mediaImage.alt}
          loading="lazy"
          decoding="async"
        />
        <span className="feature-media-scanline" aria-hidden="true" />
      </div>
    </Reveal>
  );
}
