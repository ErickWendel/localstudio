import type { AnalyticsEventName, AnalyticsService } from '../contracts/interfaces';

type PostHogClient = {
  capture(eventName: string, properties?: Record<string, unknown>): void;
  init?(
    projectApiKey: string,
    options?: {
      api_host?: string;
      capture_pageview?: boolean;
      persistence?: 'localStorage' | 'memory';
    },
  ): void;
};

type AnalyticsWindow = Window & {
  posthog?: PostHogClient | undefined;
};

function getPostHogClient(): PostHogClient | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as AnalyticsWindow).posthog;
}

export class BrowserPostHogAnalyticsService implements AnalyticsService {
  private initialized = false;

  capture(
    eventName: AnalyticsEventName,
    properties?: Record<string, boolean | number | string | undefined>,
  ) {
    const posthog = this.getConfiguredClient();
    posthog?.capture(eventName, properties);
  }

  private getConfiguredClient() {
    const posthog = getPostHogClient();
    if (!posthog) return undefined;
    if (!this.initialized) {
      this.initialized = true;
      const apiKey = import.meta.env.VITE_POSTHOG_KEY;
      if (apiKey && posthog.init) {
        posthog.init(apiKey, {
          api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
          capture_pageview: false,
          persistence: import.meta.env.MODE === 'test' ? 'memory' : 'localStorage',
        });
      }
    }
    return posthog;
  }
}
