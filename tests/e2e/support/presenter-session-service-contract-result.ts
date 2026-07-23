export type PresenterSessionServiceContractResult = {
  blockedStatus: string;
  commandNames: string[];
  duplicateSessionReused: boolean;
  hostCloseCount: number;
  hostOpenCount: number;
  hostPreviewBatchCount: number;
  hostStateCount: number;
  legacyCommandNames: string[];
  legacyCloseCount: number;
  legacyPublishCount: number;
  openedPopupHrefIncludesPresenter: boolean;
  openedStatus: string;
  popupClosed: boolean;
  popupCommandCount: number;
  popupStateCount: number;
  remoteSession: {
    controlPeerId: string | undefined;
    qrUrl: string;
    transport: string | undefined;
  };
};

type PresenterSessionContractStatus = {
  status: string;
};

type PresenterSessionContractSession = {
  controlPeerId: string | undefined;
  qrUrl: string;
  sessionId: string;
  transport: string | undefined;
};

type PresenterSessionServiceContractResultInput = {
  blocked: PresenterSessionContractStatus;
  commands: unknown[];
  countPresenterMessages: (messages: unknown[], type: 'command' | 'state') => number;
  duplicateSession: Pick<PresenterSessionContractSession, 'sessionId'>;
  getPresenterCommandNames: (commands: unknown[]) => string[];
  host: {
    closeCount: number;
    openCount: number;
    previewBatches: unknown[];
    states: unknown[];
  };
  legacyCommands?: unknown[];
  legacyCloseCount?: number;
  legacyPublishCount?: number;
  opened: PresenterSessionContractStatus;
  popup: {
    closed: boolean;
    location: { href: string };
    messages: unknown[];
  };
  remoteSession: PresenterSessionContractSession;
};

export function createPresenterSessionServiceContractResult({
  blocked,
  commands,
  countPresenterMessages,
  duplicateSession,
  getPresenterCommandNames,
  host,
  legacyCloseCount,
  legacyCommands,
  legacyPublishCount,
  opened,
  popup,
  remoteSession,
}: PresenterSessionServiceContractResultInput): PresenterSessionServiceContractResult {
  return {
    blockedStatus: blocked.status,
    commandNames: getPresenterCommandNames(commands),
    duplicateSessionReused: duplicateSession.sessionId === remoteSession.sessionId,
    hostCloseCount: host.closeCount,
    hostOpenCount: host.openCount,
    hostPreviewBatchCount: host.previewBatches.length,
    hostStateCount: host.states.length,
    legacyCommandNames: getPresenterCommandNames(legacyCommands ?? []),
    legacyCloseCount: legacyCloseCount ?? 0,
    legacyPublishCount: legacyPublishCount ?? 0,
    openedPopupHrefIncludesPresenter: popup.location.href.includes('presenter=1'),
    openedStatus: opened.status,
    popupClosed: popup.closed,
    popupCommandCount: countPresenterMessages(popup.messages, 'command'),
    popupStateCount: countPresenterMessages(popup.messages, 'state'),
    remoteSession: {
      controlPeerId: remoteSession.controlPeerId,
      qrUrl: remoteSession.qrUrl,
      transport: remoteSession.transport,
    },
  };
}
