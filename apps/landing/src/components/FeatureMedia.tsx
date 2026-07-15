import { type CSSProperties } from 'react';
import { featureMediaImages } from '../content/featureMediaImages';
import { Reveal } from './Reveal';

type FeatureMediaStyle = CSSProperties & { '--feature-media-ratio'?: string };

export function FeatureMedia({ feature }: { feature: keyof typeof featureMediaImages }) {
  const mediaImage = featureMediaImages[feature];
  const mediaImageStyle: FeatureMediaStyle = { '--feature-media-ratio': mediaImage.aspectRatio };

  return (
    <Reveal as="div" className="feature-media with-image" delay={80} reveal="showcase-media">
      <div
        className="feature-media-canvas"
        data-feature={feature}
        aria-label={`${feature} feature preview`}
        style={mediaImageStyle}
      >
        <picture className="feature-media-picture">
          <source
            type="image/webp"
            srcSet={mediaImage.srcSet}
            sizes="(max-width: 760px) 92vw, 645px"
          />
          <img
            className="feature-media-image"
            src={mediaImage.src}
            alt={mediaImage.alt}
            width={mediaImage.width}
            height={mediaImage.height}
            loading="lazy"
            decoding="async"
          />
        </picture>
        <span className="feature-media-scanline" aria-hidden="true" />
      </div>
    </Reveal>
  );
}
