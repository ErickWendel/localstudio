import { useEffect, useMemo, useState } from 'react';
import { createAppServices } from './app/composition';
import { createBlankProject } from './domain/sampleProject';
import type { LocalSetupState } from './services/interfaces';
import { EditorShell } from './ui/editor/EditorShell';
import { FirstRunSetupScreen } from './ui/setup/FirstRunSetupScreen';

export function App() {
  const services = useMemo(() => {
    const url = new URL(window.location.href);
    const shouldStartBlankProject = url.searchParams.get('newProject') === '1';
    if (shouldStartBlankProject) {
      url.searchParams.delete('newProject');
      url.searchParams.delete('project');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    return createAppServices(
      shouldStartBlankProject
        ? {
            initialProject: createBlankProject(),
            skipStoredProjectLoad: true,
          }
        : (() => {
            const storedProjectName = url.searchParams.get('project');
            return storedProjectName ? { storedProjectName } : {};
          })(),
    );
  }, []);

  const [setupState, setSetupState] = useState<LocalSetupState | undefined>();
  const [setupComplete, setSetupComplete] = useState(() => services.localSetupService.hasCompletedSetup());

  useEffect(() => {
    if (setupComplete) return;
    void services.localSetupService.checkReadiness().then(setSetupState);
  }, [services.localSetupService, setupComplete]);

  if (!setupComplete) {
    if (!setupState) {
      return (
        <main className="setup-screen">
          <p className="setup-loading">Checking local setup...</p>
        </main>
      );
    }

    return (
      <FirstRunSetupScreen
        setupState={setupState}
        onRefresh={() => {
          void services.localSetupService.checkReadiness().then(setSetupState);
        }}
        onContinue={() => {
          services.localSetupService.markSetupComplete();
          setSetupComplete(true);
        }}
      />
    );
  }

  return <EditorShell services={services} />;
}
