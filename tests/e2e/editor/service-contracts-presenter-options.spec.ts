import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter peer options and timer contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
    const [{ getRuntimePeerOptions }, { presenterRemoteTimerFormat }] =
      (await Promise.all([
        import(`${presenterRemoteSourceRoot}/peer-options.ts`),
        import(`${presenterRemoteSourceRoot}/timer-format.ts`),
      ])) as [
        typeof import('../../../packages/presenter-remote/src/peer-options'),
        typeof import('../../../packages/presenter-remote/src/timer-format'),
      ];

    globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = {
      host: 'localhost',
      path: '/peerjs',
      port: 9000,
      secure: false,
    };
    const peerOptions = getRuntimePeerOptions();
    globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = { host: '', port: 0 };
    const missingPeerOptions = getRuntimePeerOptions();

    return {
      missingPeerOptions,
      peerOptions,
      timers: [
        presenterRemoteTimerFormat.formatElapsed(-1),
        presenterRemoteTimerFormat.formatElapsed(65_000),
        presenterRemoteTimerFormat.formatElapsed(3_661_000),
      ],
    };
  }, { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot });

  expect(result).toEqual({
    missingPeerOptions: undefined,
    peerOptions: { host: 'localhost', path: '/peerjs', port: 9000, secure: false },
    timers: ['00:00', '01:05', '01:01:01'],
  });
});
