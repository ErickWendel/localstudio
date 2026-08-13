export async function seekPresenterVideoFrame(
  element: Element,
  targetTime: number,
): Promise<void> {
  const movie = element as HTMLVideoElement;
  movie.pause();
  await new Promise<void>((resolve) => {
    if (Math.abs(movie.currentTime - targetTime) < 0.01) {
      resolve();
      return;
    }
    movie.addEventListener('seeked', () => resolve(), { once: true });
    movie.currentTime = targetTime;
  });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
