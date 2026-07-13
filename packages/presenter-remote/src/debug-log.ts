type DebugLogLevel = 'error' | 'info' | 'warn';

const presenterRemoteDebugStorageKey = 'localstudio.presenterRemoteDebug';

function isPresenterRemoteInfoLoggingEnabled() {
  try {
    return globalThis.localStorage?.getItem(presenterRemoteDebugStorageKey) === 'true';
  } catch {
    return false;
  }
}

function write(level: DebugLogLevel, message: string, detail?: unknown) {
  if (level === 'info' && !isPresenterRemoteInfoLoggingEnabled()) return;
  const prefix = '[LocalStudio presenter remote]';
  if (detail === undefined) {
    globalThis.console[level](prefix, message);
    return;
  }
  globalThis.console[level](prefix, message, stringifyDetail(detail));
}

function stringifyDetail(detail: unknown) {
  if (detail instanceof Error) {
    return `${detail.name}: ${detail.message}`;
  }
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export const presenterRemoteDebugLog = {
  error: (message: string, detail?: unknown) => write('error', message, detail),
  info: (message: string, detail?: unknown) => write('info', message, detail),
  warn: (message: string, detail?: unknown) => write('warn', message, detail),
};
