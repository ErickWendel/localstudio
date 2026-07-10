import { useRef } from 'react';
import type { PointerEvent, TouchEvent } from 'react';

const swipeThresholdPx = 44;

export function useHorizontalSwipeNavigation(
  onNavigate: (direction: 'next' | 'previous') => void,
) {
  const touchStartX = useRef<number | undefined>(undefined);
  const pointerStartX = useRef<number | undefined>(undefined);

  function handleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX;
  }

  function handleTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    const startX = touchStartX.current;
    touchStartX.current = undefined;
    const endX = event.changedTouches[0]?.clientX;
    if (startX === undefined || endX === undefined) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < swipeThresholdPx) return;
    onNavigate(deltaX < 0 ? 'next' : 'previous');
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse') return;
    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse') return;
    const startX = pointerStartX.current;
    pointerStartX.current = undefined;
    if (startX === undefined) return;
    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) < swipeThresholdPx) return;
    onNavigate(deltaX < 0 ? 'next' : 'previous');
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onTouchEnd: handleTouchEnd,
    onTouchStart: handleTouchStart,
  };
}
