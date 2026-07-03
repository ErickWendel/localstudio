function describeError(error: unknown) {
  if (error instanceof Error) return { message: error.message, name: error.name };
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; name?: unknown };
    return {
      message: typeof record.message === 'string' ? record.message : Object.prototype.toString.call(error),
      name: typeof record.name === 'string' ? record.name : 'UnknownError',
    };
  }
  return { message: String(error), name: 'UnknownError' };
}

function info(message: string, details?: Record<string, unknown>) {
  console.info('[LocalStudio PPTX Import]', message, details ?? {});
}

function error(message: string, importError: unknown, details?: Record<string, unknown>) {
  console.error('[LocalStudio PPTX Import]', message, {
    ...details,
    error: describeError(importError),
  });
}

export const pptxImportLogger = {
  describeError,
  error,
  info,
};
