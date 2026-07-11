import type { PresenterSessionServiceContractResult } from '../support/presenter-session-service-contract-scenario';

export type PresenterSessionServiceContractInput = {
  editorSourceRoot: string;
  testSupportSourceRoot: string;
};

export async function evaluatePresenterSessionServiceContract({
  editorSourceRoot,
  testSupportSourceRoot,
}: PresenterSessionServiceContractInput): Promise<PresenterSessionServiceContractResult> {
  const [{ loadPresenterSessionServiceModules }, { runPresenterSessionServiceContractScenario }] =
    (await Promise.all([
      import(`${testSupportSourceRoot}/presenter-session-service-modules.ts`),
      import(`${testSupportSourceRoot}/presenter-session-service-contract-scenario.ts`),
    ])) as [
      typeof import('../support/presenter-session-service-modules'),
      typeof import('../support/presenter-session-service-contract-scenario'),
    ];
  const modules = await loadPresenterSessionServiceModules({
    editorSourceRoot,
    testSupportSourceRoot,
  });

  return runPresenterSessionServiceContractScenario(modules);
}
