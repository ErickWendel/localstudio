type LandingScrollRestorationEnvironment = {
  history: Pick<History, 'scrollRestoration'>;
  location: Pick<Location, 'hash'>;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  scrollTo: Window['scrollTo'];
};

export function configureLandingScrollRestoration({
  history,
  location,
  requestAnimationFrame,
  scrollTo,
}: LandingScrollRestorationEnvironment) {
  history.scrollRestoration = 'manual';

  if (location.hash && location.hash !== '#top') {
    return;
  }

  const resetScroll = () => {
    scrollTo({ left: 0, top: 0, behavior: 'instant' as ScrollBehavior });
  };

  if (requestAnimationFrame) {
    requestAnimationFrame(resetScroll);
    return;
  }

  resetScroll();
}
