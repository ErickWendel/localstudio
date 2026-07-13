export type PresenterLoggingContractInput = {
  presenterRemoteSourceRoot: string;
};

export type PresenterLoggingContractResult = {
  logs: string[];
};

export async function evaluatePresenterLoggingContract({
  presenterRemoteSourceRoot,
}: PresenterLoggingContractInput): Promise<PresenterLoggingContractResult> {
  const { presenterRemoteDebugLog } = (await import(
    `${presenterRemoteSourceRoot}/debug-log.ts`
  )) as typeof import('../../../packages/presenter-remote/src/debug-log');

  const logs: string[] = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  try {
    localStorage.removeItem('localstudio.presenterRemoteDebug');
    console.info = (...values: unknown[]) => logs.push(`info:${values.join('|')}`);
    console.warn = (...values: unknown[]) => logs.push(`warn:${values.join('|')}`);
    console.error = (...values: unknown[]) => logs.push(`error:${values.join('|')}`);
    presenterRemoteDebugLog.info('ready');
    localStorage.setItem('localstudio.presenterRemoteDebug', 'true');
    presenterRemoteDebugLog.info('enabled');
    presenterRemoteDebugLog.warn('object', { ok: true });
    presenterRemoteDebugLog.error('failure', new TypeError('bad stream'));
    const circular: { self?: unknown } = {};
    circular.self = circular;
    presenterRemoteDebugLog.warn('circular', circular);
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    localStorage.removeItem('localstudio.presenterRemoteDebug');
  }

  return { logs };
}
