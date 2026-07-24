import type { AnalyticsEventName, AnalyticsService } from '../contracts/interfaces';
import { posthog } from './posthog';

export class BrowserPostHogAnalyticsService implements AnalyticsService {
  capture(
    eventName: AnalyticsEventName,
    properties?: Record<string, boolean | number | string | undefined>,
  ) {
    posthog.capture(eventName, properties);
  }
}
