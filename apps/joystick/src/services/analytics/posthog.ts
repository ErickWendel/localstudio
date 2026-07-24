import posthog from 'posthog-js';
import { localStudioAnalyticsConfig } from '@localstudio/analytics-config/config';

const postHogConfig = localStudioAnalyticsConfig.postHog;

if (!postHogConfig.apiKey) {
  if (import.meta.env.DEV) {
    console.warn(
      'PostHog is missing a configured apiKey in @localstudio/analytics-config/config.',
    );
  }
} else {
  posthog.init(postHogConfig.apiKey, {
    api_host: postHogConfig.apiHost,
    autocapture: true,
    capture_pageview: true,
    enable_recording_console_log: false,
  });
}
