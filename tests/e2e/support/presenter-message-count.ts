export function countPresenterMessages(messages: unknown[], type: 'command' | 'state'): number {
  return messages.filter(
    (message) =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === type,
  ).length;
}
