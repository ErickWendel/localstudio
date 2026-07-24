import { BrowserPostHogAnalyticsService } from '../../../src/services/analytics/posthogAnalyticsService';
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    init: vi.fn(),
  },
}));

describe('BrowserPostHogAnalyticsService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates capture calls to the shared PostHog singleton', () => {
    const service = new BrowserPostHogAnalyticsService();

    service.capture('model_downloaded', { modelId: 'gemma' });
    service.capture('stock_media_inserted', { provider: 'unsplash' });

    const captureCalls = (posthog.capture as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(captureCalls).toEqual([
      ['model_downloaded', { modelId: 'gemma' }],
      ['stock_media_inserted', { provider: 'unsplash' }],
    ]);
  });
});
