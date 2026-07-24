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

    service.capture('project_saved_local', { pageCount: 3 });
    service.capture('deck_translated', { targetLanguage: 'pt' });

    const captureCalls = (posthog.capture as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(captureCalls).toEqual([
      ['project_saved_local', { pageCount: 3 }],
      ['deck_translated', { targetLanguage: 'pt' }],
    ]);
  });
});
