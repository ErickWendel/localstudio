import type { MouseEvent } from 'react';
import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';
import { SlideCanvas } from './SlideCanvas';
import { useHorizontalSwipeNavigation } from './use-horizontal-swipe-navigation';

export function SlidePreview({
  renderMediaAssets = true,
  onNavigate,
  preview,
}: {
  renderMediaAssets?: boolean;
  onNavigate: (direction: 'next' | 'previous') => void;
  preview: PresenterRemoteSlidePreview | undefined;
}) {
  const swipeHandlers = useHorizontalSwipeNavigation(onNavigate);

  function handleStageClick(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    onNavigate(event.clientX - bounds.left < bounds.width / 2 ? 'previous' : 'next');
  }

  return (
    <button
      type="button"
      className="joystick-stage-button"
      aria-label="Current slide preview"
      onClick={handleStageClick}
      {...swipeHandlers}
    >
      <SlideCanvas preview={preview} renderMediaAssets={renderMediaAssets} />
    </button>
  );
}
