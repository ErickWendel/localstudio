export function dispatchPresenterWindowCommand(
  targetWindow: Window,
  origin: string,
  data: Record<string, unknown>,
): void {
  targetWindow.dispatchEvent(
    new MessageEvent('message', {
      data: {
        ...data,
        source: 'localstudio-presenter-window',
        type: 'command',
      },
      origin,
    }),
  );
}
