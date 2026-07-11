import type { PresenterRemoteState } from '@localstudio/presenter-remote/protocol';
import { SlideCanvas } from './SlideCanvas';

export function UpcomingSlideStrip({
  onGoToPage,
  previews,
  renderMediaAssets = true,
  startSlideNumber,
}: {
  onGoToPage: (pageId: string) => void;
  previews: NonNullable<PresenterRemoteState['upcomingSlidePreviews']>;
  renderMediaAssets?: boolean;
  startSlideNumber: number;
}) {
  if (previews.length === 0) {
    return null;
  }

  return (
    <section className="joystick-upcoming-strip" aria-label="Upcoming slides">
      {previews.map((item, index) => {
        const slideNumber = startSlideNumber + index;
        return (
          <button
            type="button"
            className="joystick-upcoming-thumb"
            key={item.pageId}
            aria-label={`Go to slide ${slideNumber}: ${item.pageName}`}
            onClick={() => onGoToPage(item.pageId)}
          >
            <span>Slide {slideNumber}</span>
            <SlideCanvas compact preview={item.preview} renderMediaAssets={renderMediaAssets} />
          </button>
        );
      })}
    </section>
  );
}
