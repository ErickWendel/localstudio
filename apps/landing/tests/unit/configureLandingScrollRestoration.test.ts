import { describe, expect, it, vi } from 'vitest';
import { configureLandingScrollRestoration } from '../../src/routing/configureLandingScrollRestoration';

function createEnvironment(hash = '') {
  return {
    history: { scrollRestoration: 'auto' as ScrollRestoration },
    location: { hash },
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
    scrollTo: vi.fn(),
  };
}

describe('landing scroll restoration', () => {
  it('disables browser scroll restoration and resets top-level reloads', () => {
    const environment = createEnvironment();

    configureLandingScrollRestoration(environment);

    expect(environment.history.scrollRestoration).toBe('manual');
    expect(environment.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
  });

  it('resets explicit top hash reloads', () => {
    const environment = createEnvironment('#top');

    configureLandingScrollRestoration(environment);

    expect(environment.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
  });

  it('preserves real section hash reloads', () => {
    const environment = createEnvironment('#features');

    configureLandingScrollRestoration(environment);

    expect(environment.history.scrollRestoration).toBe('manual');
    expect(environment.scrollTo).not.toHaveBeenCalled();
  });
});
