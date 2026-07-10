import { X } from 'lucide-react';
import type { PresenterRemoteState } from '@localstudio/presenter-remote/protocol';
import { SlideCanvas } from './SlideCanvas';

function getSlideNavigatorPreview(
  page: NonNullable<PresenterRemoteState['pages']>[number],
  displayedRemoteState: PresenterRemoteState | undefined,
  upcomingSlidePreviews: NonNullable<PresenterRemoteState['upcomingSlidePreviews']>,
) {
  if (page.preview) return page.preview;
  if (page.id === displayedRemoteState?.activePageId) return displayedRemoteState.slidePreview;
  return upcomingSlidePreviews.find((item) => item.pageId === page.id)?.preview;
}

export function SlideNavigatorSheet({
  displayedRemoteState,
  onClose,
  onGoToPage,
  pages,
  renderMediaAssets,
  upcomingSlidePreviews,
}: {
  displayedRemoteState: PresenterRemoteState | undefined;
  onClose: () => void;
  onGoToPage: (pageId: string) => void;
  pages: NonNullable<PresenterRemoteState['pages']>;
  renderMediaAssets: boolean;
  upcomingSlidePreviews: NonNullable<PresenterRemoteState['upcomingSlidePreviews']>;
}) {
  return (
    <section
      className="joystick-slide-navigator"
      role="dialog"
      aria-modal="true"
      aria-label="Slide navigation"
    >
      <header>
        <div>
          <h2>Go to slide</h2>
          <p>{displayedRemoteState?.deckName ?? 'Presentation'}</p>
        </div>
        <button type="button" aria-label="Close slide navigation" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="joystick-slide-navigator-list">
        {pages.map((page, index) => {
          const preview = getSlideNavigatorPreview(
            page,
            displayedRemoteState,
            upcomingSlidePreviews,
          );
          const active = page.id === displayedRemoteState?.activePageId;
          return (
            <button
              type="button"
              key={page.id}
              aria-current={active ? 'page' : undefined}
              aria-label={`Go to slide ${index + 1}: ${page.name}`}
              onClick={() => {
                onGoToPage(page.id);
                onClose();
              }}
            >
              <span className="joystick-slide-navigator-thumb" aria-hidden="true">
                <SlideCanvas compact preview={preview} renderMediaAssets={renderMediaAssets} />
              </span>
              <span className="joystick-slide-navigator-meta">
                <span>{active ? 'Current' : `Slide ${index + 1}`}</span>
                <strong>{page.name}</strong>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
