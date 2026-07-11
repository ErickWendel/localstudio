import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter debug logging contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
    const { presenterRemoteDebugLog } = (await import(
      `${presenterRemoteSourceRoot}/debug-log.ts`
    )) as typeof import('../../../packages/presenter-remote/src/debug-log');

    const logs: string[] = [];
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.info = (...values: unknown[]) => logs.push(`info:${values.join('|')}`);
    console.warn = (...values: unknown[]) => logs.push(`warn:${values.join('|')}`);
    console.error = (...values: unknown[]) => logs.push(`error:${values.join('|')}`);
    presenterRemoteDebugLog.info('ready');
    presenterRemoteDebugLog.warn('object', { ok: true });
    presenterRemoteDebugLog.error('failure', new TypeError('bad stream'));
    const circular: { self?: unknown } = {};
    circular.self = circular;
    presenterRemoteDebugLog.warn('circular', circular);
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;

    return { logs };
  }, { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot });

  expect(result.logs).toEqual(
    expect.arrayContaining([
      expect.stringContaining('info:[LocalStudio presenter remote]|ready'),
      expect.stringContaining('warn:[LocalStudio presenter remote]|object|{"ok":true}'),
      expect.stringContaining('error:[LocalStudio presenter remote]|failure|TypeError: bad stream'),
      expect.stringContaining('warn:[LocalStudio presenter remote]|circular|[object Object]'),
    ]),
  );
});
