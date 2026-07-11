import type { FakeRemotePeerControlHost } from './fake-remote-peer-control-host';

export function emitPresenterSessionRemoteCommandSequence(host: FakeRemotePeerControlHost): void {
  host.emitCommand({ command: 'request-previews', pageIds: ['slide-1', 'slide-2'], type: 'command' });
  host.emitCommand({ command: 'update-notes', notes: 'Updated note', pageId: 'slide-1', type: 'command' });
  host.emitCommand({ command: 'go-to-page', pageId: 'slide-2', type: 'command' });
  host.emitCommand({ command: 'pause-timer', type: 'command' });
  host.emitCommand({ command: 'next', type: 'command' });
}
