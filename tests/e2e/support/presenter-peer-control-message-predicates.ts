function hasCommand(message: unknown, command: string) {
  return (
    typeof message === 'object' &&
    message !== null &&
    'command' in message &&
    message.command === command
  );
}

function hasType(message: unknown, type: string) {
  return typeof message === 'object' && message !== null && 'type' in message && message.type === type;
}

export const presenterPeerControlMessagePredicates = {
  countMessages(messages: unknown[], predicate: (message: unknown) => boolean) {
    return messages.filter(predicate).length;
  },

  hasCommand,

  hasConnectedControllerCount(message: unknown, connectedControllerCount: number) {
    return (
      hasType(message, 'state') &&
      'connectedControllerCount' in message &&
      message.connectedControllerCount === connectedControllerCount
    );
  },

  hasType,
} as const;
