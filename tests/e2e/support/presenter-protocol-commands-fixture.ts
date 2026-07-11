export function createPresenterProtocolCommands() {
  return [
    { command: 'close', type: 'command' },
    { command: 'next', type: 'command' },
    { command: 'previous', type: 'command' },
    { command: 'pause-timer', type: 'command' },
    { command: 'resume-timer', type: 'command' },
    { command: 'reset-timer', type: 'command' },
    { command: 'request-state', type: 'command' },
    { command: 'start-presenting', type: 'command' },
    { command: 'go-to-page', pageId: 'page-2', type: 'command' },
    { command: 'request-previews', pageIds: ['page-1'], requestId: 'request-1', type: 'command' },
    { command: 'update-notes', notes: 'Updated', pageId: 'page-1', type: 'command' },
  ];
}
