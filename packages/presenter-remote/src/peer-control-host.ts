import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import {
  presenterRemoteProtocol,
  type PresenterRemoteCommand,
  type PresenterRemoteMessage,
  type PresenterRemotePreviewBatch,
  type PresenterRemoteSession,
  type PresenterRemoteState,
} from './protocol';
import { presenterRemoteDebugLog } from './debug-log';

const peerDataChannelMaxStateBytes = 16_000;

export interface PresenterRemotePeerSession extends PresenterRemoteSession {
  controlPeerId: string;
  transport: 'peerjs';
}

export interface PresenterRemotePeerControlHostOptions {
  connectionTimeoutMs?: number | undefined;
  now?: (() => number) | undefined;
  onCommand?: ((command: PresenterRemoteCommand) => void) | undefined;
  peerFactory?: (() => Peer) | undefined;
  peerOptions?: PeerOptions | undefined;
  presenterDeviceId?: string | undefined;
  presenterLabel: string;
  ttlMs: number;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `peer-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function oncePeerOpen(peer: Peer) {
  if (peer.open && peer.id) return Promise.resolve(peer.id);
  return new Promise<string>((resolve, reject) => {
    peer.on('open', resolve);
    peer.on('error', reject);
  });
}

function rejectAfter(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('PeerJS host connection timed out.')), timeoutMs);
  });
}

export class PresenterRemotePeerControlHost {
  private readonly connections = new Set<DataConnection>();
  private readonly now: () => number;
  private readonly onCommand: ((command: PresenterRemoteCommand) => void) | undefined;
  private readonly options: PresenterRemotePeerControlHostOptions;
  private lastState: PresenterRemoteState | undefined;
  private peer: Peer | undefined;
  private session: PresenterRemotePeerSession | undefined;

  constructor(options: PresenterRemotePeerControlHostOptions) {
    this.now = options.now ?? Date.now;
    this.onCommand = options.onCommand;
    this.options = options;
  }

  async open(): Promise<PresenterRemotePeerSession> {
    if (this.session) return this.session;
    const peer =
      this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    presenterRemoteDebugLog.info('Opening control host peer.');
    peer.on('connection', (connection) => this.registerConnection(connection));
    peer.on('error', (error) => presenterRemoteDebugLog.error('Control host peer error.', error));
    const controlPeerId = await Promise.race([
      oncePeerOpen(peer),
      rejectAfter(this.options.connectionTimeoutMs ?? 12_000),
    ]);
    presenterRemoteDebugLog.info('Control host peer opened.', { controlPeerId });
    this.session = {
      code: controlPeerId,
      connectedControllerCount: 0,
      controlPeerId,
      expiresAt: new Date(this.now() + this.options.ttlMs).toISOString(),
      presenterDeviceId: this.options.presenterDeviceId ?? this.options.presenterLabel,
      presenterLabel: this.options.presenterLabel,
      sessionId: createSessionId(),
      transport: 'peerjs',
    };
    return this.session;
  }

  publishState(state: PresenterRemoteState) {
    this.lastState = createDataChannelSafeState({
      ...state,
      connectedControllerCount: this.connections.size,
    });
    presenterRemoteDebugLog.info('Publishing remote state.', {
      activePageId: this.lastState.activePageId,
      connectedControllerCount: this.connections.size,
      hasSlidePreview: Boolean(this.lastState.slidePreview),
      streamPeerId: this.lastState.stream?.peerId,
    });
    for (const connection of this.connections) {
      this.sendMessage(connection, this.lastState, 'remote state');
    }
  }

  publishPreviewBatch(batch: PresenterRemotePreviewBatch) {
    presenterRemoteDebugLog.info('Publishing preview batch.', {
      previewCount: batch.previews.length,
      requestId: batch.requestId,
      stateBytes: getJsonByteLength(batch),
    });
    for (const connection of this.connections) {
      this.sendMessage(connection, batch, 'preview batch');
    }
  }

  close() {
    presenterRemoteDebugLog.info('Closing control host peer.');
    for (const connection of this.connections) connection.close();
    this.connections.clear();
    this.peer?.destroy();
    this.peer = undefined;
    this.session = undefined;
    this.lastState = undefined;
  }

  private registerConnection(connection: DataConnection) {
    presenterRemoteDebugLog.info('Control connection received.');
    const addConnection = () => {
      this.connections.add(connection);
      presenterRemoteDebugLog.info('Control connection opened.', {
        connectedControllerCount: this.connections.size,
      });
      if (this.lastState) {
        this.sendMessage(
          connection,
          {
            ...this.lastState,
            connectedControllerCount: this.connections.size,
          },
          'initial remote state',
        );
      }
    };
    connection.on('open', addConnection);
    if (connection.open) addConnection();
    connection.on('data', (data) => {
      if (!presenterRemoteProtocol.isCommand(data)) return;
      presenterRemoteDebugLog.info('Control command received.', { command: data.command });
      if (data.command === 'request-state' && this.lastState) {
        this.sendMessage(
          connection,
          {
            ...this.lastState,
            connectedControllerCount: this.connections.size,
          },
          'requested remote state',
        );
      }
      this.onCommand?.(data);
    });
    const removeConnection = () => {
      this.connections.delete(connection);
      presenterRemoteDebugLog.info('Control connection closed.', {
        connectedControllerCount: this.connections.size,
      });
    };
    connection.on('close', removeConnection);
    connection.on('error', (error) => {
      presenterRemoteDebugLog.error('Control connection error.', error);
      removeConnection();
    });
  }

  private sendMessage(connection: DataConnection, message: PresenterRemoteMessage, label: string) {
    try {
      presenterRemoteDebugLog.info(`Sending ${label} over data connection.`, {
        pagesWithPreviewCount:
          message.type === 'state'
            ? (message.pages?.filter((page) => Boolean(page.preview)).length ?? 0)
            : message.previews.filter((page) => Boolean(page.preview)).length,
        stateBytes: getJsonByteLength(message),
      });
      void connection.send(message);
    } catch (error) {
      presenterRemoteDebugLog.error(`Failed to send ${label}.`, error);
    }
  }
}

function createDataChannelSafeState(state: PresenterRemoteState): PresenterRemoteState {
  const stateBytes = getJsonByteLength(state);
  if (stateBytes <= peerDataChannelMaxStateBytes) return state;
  const safeState: PresenterRemoteState = {
    ...state,
    nextSlidePreview: undefined,
    pages: state.pages?.map((page) => ({
      id: page.id,
      name: page.name,
    })),
    slidePreview: undefined,
    upcomingSlidePreviews: [],
  };
  presenterRemoteDebugLog.warn(
    'Remote state was too large for PeerJS data channel; using stream-only state.',
    {
      safeBytes: getJsonByteLength(safeState),
      stateBytes,
    },
  );
  return safeState;
}

function getJsonByteLength(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
