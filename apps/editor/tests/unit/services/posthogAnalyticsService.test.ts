import { BrowserPostHogAnalyticsService } from '../../../src/services/analytics/posthogAnalyticsService';
import { localStudioAnalyticsConfig } from '@localstudio/analytics-config/config';
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    init: vi.fn(),
  },
}));

describe('BrowserPostHogAnalyticsService', () => {
  const postHogEvents = localStudioAnalyticsConfig.postHog.events;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates capture calls to the shared PostHog singleton', () => {
    const service = new BrowserPostHogAnalyticsService();

    service.capture(postHogEvents.modelDownloaded, { modelId: 'gemma' });
    service.capture(postHogEvents.stockMediaInserted, { provider: 'unsplash' });

    const captureCalls = (posthog.capture as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(captureCalls).toEqual([
      [postHogEvents.modelDownloaded, { modelId: 'gemma' }],
      [postHogEvents.stockMediaInserted, { provider: 'unsplash' }],
    ]);
  });

  it('keeps tracked PostHog event names centralized in analytics config', () => {
    expect(new Set(Object.values(postHogEvents)).size).toBe(Object.values(postHogEvents).length);
    expect(Object.values(postHogEvents)).toEqual([
      'ai_image_generated',
      'ai_slide_generated',
      'background_removed',
      'deck_translated',
      'font_downloaded',
      'local_font_imported',
      'local_media_imported',
      'model_downloaded',
      'presentation_exported_images',
      'presentation_exported_pptx',
      'presentation_imported_pptx',
      'presentation_shared',
      'presentation_started_fullscreen',
      'presenter_remote_opened',
      'presenter_view_opened',
      'project_imported_local',
      'project_restored_version',
      'project_saved_local',
      'project_synced_remote_mirror',
      'prompt_generated_image',
      'prompt_generated_slide',
      'remote_mirror_imported',
      'share_link_copied',
      'stock_media_inserted',
    ]);
  });
});
