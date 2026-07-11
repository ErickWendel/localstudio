export type PresenterProtocolCommandChecksInput = {
  presenterRemoteSourceRoot: string;
};

export async function evaluatePresenterProtocolCommandChecks({
  presenterRemoteSourceRoot,
}: PresenterProtocolCommandChecksInput): Promise<Record<string, boolean>> {
  const { presenterRemoteProtocol } = (await import(
    `${presenterRemoteSourceRoot}/protocol.ts`
  )) as typeof import('../../../packages/presenter-remote/src/protocol');

  return {
    acceptsClose: presenterRemoteProtocol.isCommand({ command: 'close', type: 'command' }),
    acceptsGoToPage: presenterRemoteProtocol.isCommand({
      command: 'go-to-page',
      pageId: 'page-1',
      type: 'command',
    }),
    acceptsRequestPreviews: presenterRemoteProtocol.isCommand({
      command: 'request-previews',
      pageIds: ['page-1'],
      requestId: 'preview-request',
      type: 'command',
    }),
    acceptsUpdateNotes: presenterRemoteProtocol.isCommand({
      command: 'update-notes',
      notes: 'Updated note',
      pageId: 'page-1',
      type: 'command',
    }),
    rejectsBadPageId: !presenterRemoteProtocol.isCommand({
      command: 'go-to-page',
      pageId: 1,
      type: 'command',
    }),
    rejectsBadPreviewRequest: !presenterRemoteProtocol.isCommand({
      command: 'request-previews',
      pageIds: ['slide-1', 2],
      type: 'command',
    }),
    rejectsUnknownCommand: !presenterRemoteProtocol.isCommand({
      command: 'unknown',
      type: 'command',
    }),
  };
}
