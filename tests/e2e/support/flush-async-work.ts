export function flushAsyncWork(): Promise<unknown> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
