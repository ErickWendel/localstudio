export type PresenterSessionServiceModulesInput = {
  editorSourceRoot: string;
  testSupportSourceRoot: string;
};

export async function loadPresenterSessionServiceModules({
  editorSourceRoot,
  testSupportSourceRoot,
}: PresenterSessionServiceModulesInput) {
  const [
    { BrowserPresenterSessionService },
    { countPresenterMessages },
    { createFakePresenterPopup },
    { createFakeRemotePeerControlHost },
    { dispatchPresenterSessionWindowCommandSequence },
    { emitPresenterSessionRemoteCommandSequence },
    { flushAsyncWork },
    { getPresenterCommandNames },
    { presenterRoutePayload },
  ] = (await Promise.all([
    import(`${editorSourceRoot}/services/presenter/presenterSessionService.ts`),
    import(`${testSupportSourceRoot}/presenter-message-count.ts`),
    import(`${testSupportSourceRoot}/fake-presenter-popup.ts`),
    import(`${testSupportSourceRoot}/fake-remote-peer-control-host.ts`),
    import(`${testSupportSourceRoot}/presenter-session-window-command-sequence.ts`),
    import(`${testSupportSourceRoot}/presenter-session-remote-command-sequence.ts`),
    import(`${testSupportSourceRoot}/flush-async-work.ts`),
    import(`${testSupportSourceRoot}/presenter-command-names.ts`),
    import(`${testSupportSourceRoot}/presenter-route-payload.ts`),
  ])) as [
    typeof import('../../../apps/editor/src/services/presenter/presenterSessionService'),
    typeof import('./presenter-message-count'),
    typeof import('./fake-presenter-popup'),
    typeof import('./fake-remote-peer-control-host'),
    typeof import('./presenter-session-window-command-sequence'),
    typeof import('./presenter-session-remote-command-sequence'),
    typeof import('./flush-async-work'),
    typeof import('./presenter-command-names'),
    typeof import('./presenter-route-payload'),
  ];

  return {
    BrowserPresenterSessionService,
    countPresenterMessages,
    createFakePresenterPopup,
    createFakeRemotePeerControlHost,
    dispatchPresenterSessionWindowCommandSequence,
    emitPresenterSessionRemoteCommandSequence,
    flushAsyncWork,
    getPresenterCommandNames,
    presenterRoutePayload,
  };
}
