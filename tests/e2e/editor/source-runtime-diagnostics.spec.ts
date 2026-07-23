import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor bundled source runtime diagnostics coverage', () => {
  test('exercises bundled source service branches through the diagnostics route', async ({ page }) => {
    const url = new URL('/editor/', getServer().baseURL);
    url.searchParams.set('e2eCoverageDiagnostics', '1');
    url.searchParams.set('e2eSourceDiagnostics', '1');

    await page.goto(url.toString());
    const resultOutput = page.getByRole('status', { name: 'Diagnostics result' });
    const viewModelOutput = page.getByLabel('Source view model diagnostics');
    const componentOutput = page.getByLabel('Source component diagnostics');
    await expect(resultOutput).toBeVisible({ timeout: 15_000 });
    await expect(viewModelOutput).toBeVisible({ timeout: 15_000 });
    await expect(componentOutput).toBeVisible({ timeout: 15_000 });
    await expect(resultOutput).not.toHaveText('running', { timeout: 15_000 });
    await expect(viewModelOutput).not.toHaveText('pending', { timeout: 15_000 });
    await expect(componentOutput).not.toHaveText('pending', { timeout: 15_000 });

    const result = JSON.parse((await resultOutput.textContent()) ?? '{}') as {
      canvas?: { points?: number[] };
      googleFonts?: {
        downloaded?: number;
        loaded?: number;
        requestedUrls?: number;
        statuses?: string[];
        warnings?: string[];
      };
      ids?: { fallbackId?: string };
      presenterRemote?: {
        code?: string;
        normalizedCode?: string;
        safePages?: number;
        strippedPreview?: boolean;
        valid?: boolean;
      };
      presenterSession?: {
        commands?: string[];
        opened?: string;
        popupClosed?: boolean;
        popupMessages?: number;
        previews?: number;
        qrUrl?: string;
        remoteClosed?: boolean;
        states?: number;
      };
      prompt?: { generateCallCount?: number; taskCount?: number; text?: string };
      remotePreview?: { batches?: number; imagePreview?: boolean; mediaPreview?: boolean };
      streamPublisher?: { answered?: boolean; destroyed?: boolean; peerId?: string };
    };
    const viewModelResult = JSON.parse((await viewModelOutput.textContent()) ?? '{}') as {
      fontCount?: number;
      fontFamily?: string;
      missingFonts?: number;
    };
    const componentResult = JSON.parse((await componentOutput.textContent()) ?? '{}') as {
      events?: string[];
    };

    expect(result.prompt?.generateCallCount).toBeGreaterThanOrEqual(3);
    expect(result.prompt?.taskCount).toBeGreaterThanOrEqual(2);
    expect(result.prompt?.text).toBe('diagnostic prompt text');
    expect(result.remotePreview?.imagePreview).toBe(true);
    expect(result.remotePreview?.mediaPreview).toBe(true);
    expect(result.remotePreview?.batches).toBeGreaterThanOrEqual(1);
    expect(result.canvas?.points).toContain(10);
    expect(result.googleFonts?.downloaded).toBe(1);
    expect(result.googleFonts?.loaded).toBe(1);
    expect(result.googleFonts?.requestedUrls).toBeGreaterThanOrEqual(7);
    expect(result.googleFonts?.statuses).toEqual(
      expect.arrayContaining([
        'available-system',
        'downloaded-compatible',
        'failed',
        'missing-needs-user',
      ]),
    );
    expect(result.googleFonts?.warnings).toEqual(
      expect.arrayContaining(['font-download-failed', 'font-missing', 'font-substituted']),
    );
    expect(result.ids?.fallbackId).toMatch(/^diagnostic-/);
    expect(result.presenterRemote?.code).toBe('AAAA-AAAA');
    expect(result.presenterRemote?.normalizedCode).toBe('ABCD-1234');
    expect(result.presenterRemote?.safePages).toBeGreaterThanOrEqual(1);
    expect(result.presenterRemote?.strippedPreview).toBe(true);
    expect(result.presenterRemote?.valid).toBe(true);
    expect(result.presenterSession?.opened).toBe('opened');
    expect(result.presenterSession?.popupClosed).toBe(true);
    expect(result.presenterSession?.popupMessages).toBeGreaterThanOrEqual(2);
    expect(result.presenterSession?.previews).toBeGreaterThanOrEqual(1);
    expect(result.presenterSession?.qrUrl).toContain('peer=PEER-1234');
    expect(result.presenterSession?.remoteClosed).toBe(true);
    expect(result.presenterSession?.states).toBeGreaterThanOrEqual(2);
    expect(result.presenterSession?.commands).toEqual(
      expect.arrayContaining(['go-to-page', 'pause-timer', 'update-notes', 'update-stream-peer']),
    );
    expect(result.streamPublisher?.answered).toBe(true);
    expect(result.streamPublisher?.destroyed).toBe(true);
    expect(result.streamPublisher?.peerId).toBe('stream-peer');
    expect(viewModelResult.fontFamily).toBe('Inter');
    expect(viewModelResult.fontCount).toBeGreaterThanOrEqual(1);
    expect(viewModelResult.missingFonts).toBe(0);
    expect(componentResult.events).toEqual(
      expect.arrayContaining(['import:source-remote-a', 'delete:source-remote-a']),
    );
  });
});
