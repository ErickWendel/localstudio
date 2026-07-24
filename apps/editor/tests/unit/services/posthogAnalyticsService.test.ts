import { BrowserPostHogAnalyticsService } from '../../../src/services/analytics/posthogAnalyticsService';

describe('BrowserPostHogAnalyticsService', () => {
  const analyticsWindow = window as Window & {
    posthog?: {
      capture: ReturnType<typeof vi.fn>;
      init: ReturnType<typeof vi.fn>;
    };
  };

  afterEach(() => {
    delete analyticsWindow.posthog;
    vi.unstubAllEnvs();
  });

  it('ignores capture calls when PostHog has not been loaded', () => {
    const service = new BrowserPostHogAnalyticsService();

    expect(() => service.capture('project_saved_local')).not.toThrow();
  });

  it('initializes PostHog once and captures events when configured', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-key');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://posthog.example.test');
    analyticsWindow.posthog = {
      capture: vi.fn(),
      init: vi.fn(),
    };
    const service = new BrowserPostHogAnalyticsService();

    service.capture('project_saved_local', { pageCount: 3 });
    service.capture('deck_translated', { targetLanguage: 'pt' });

    expect(analyticsWindow.posthog.init).toHaveBeenCalledTimes(1);
    expect(analyticsWindow.posthog.init).toHaveBeenCalledWith('test-key', {
      api_host: 'https://posthog.example.test',
      capture_pageview: false,
      persistence: 'memory',
    });
    expect(analyticsWindow.posthog.capture).toHaveBeenNthCalledWith(1, 'project_saved_local', {
      pageCount: 3,
    });
    expect(analyticsWindow.posthog.capture).toHaveBeenNthCalledWith(2, 'deck_translated', {
      targetLanguage: 'pt',
    });
  });
});
