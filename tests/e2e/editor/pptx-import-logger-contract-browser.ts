export type PptxImportLoggerContractResult = {
  logs: string[];
};

export async function evaluatePptxImportLoggerContract(): Promise<PptxImportLoggerContractResult> {
  const { pptxImportLogger } = (await import(
    '/editor/src/services/importing/pptx/pptxImportLogger.ts'
  )) as typeof import('../../../apps/editor/src/services/importing/pptx/pptxImportLogger');

  const logs: string[] = [];
  const originalInfo = console.info;
  const originalError = console.error;
  try {
    console.info = (...values: unknown[]) => logs.push(`info:${JSON.stringify(values)}`);
    console.error = (...values: unknown[]) => logs.push(`error:${JSON.stringify(values)}`);
    pptxImportLogger.info('started');
    pptxImportLogger.info('with details', { slideCount: 2 });
    pptxImportLogger.error('failed', new TypeError('bad pptx'), { fileName: 'broken.pptx' });
    pptxImportLogger.error('object failed', { message: 'object message', name: 'ObjectError' });
    pptxImportLogger.error('plain failed', 'plain error');
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }

  return { logs };
}
