import type { LocalSetupState, SetupCapabilityState } from '../../services/contracts/interfaces';

const statusLabels: Record<SetupCapabilityState['status'], string> = {
  ready: 'Ready',
  unavailable: 'Unavailable',
  'needs-setup': 'Needs setup',
};

interface FirstRunSetupScreenProps {
  setupState: LocalSetupState;
  onRefresh: () => void;
  onContinue: () => void;
}

function CapabilityRow({ capability }: { capability: SetupCapabilityState }) {
  return (
    <article className="setup-capability-row">
      <div className="setup-capability-heading">
        <strong>{capability.label}</strong>
        <span className={`setup-status setup-status-${capability.status}`}>
          {statusLabels[capability.status]}
        </span>
      </div>
      <p>{capability.detail}</p>
    </article>
  );
}

export function FirstRunSetupScreen({ setupState, onRefresh, onContinue }: FirstRunSetupScreenProps) {
  const canContinue =
    setupState.fileSystem.status === 'ready' && setupState.chromeTranslation.status === 'ready';

  return (
    <main className="setup-screen">
      <section className="setup-panel" aria-labelledby="setup-title">
        <p className="setup-kicker font-orbitron">LocalStudio.dev setup</p>
        <h1 id="setup-title" className="font-orbitron">
          LocalStudio.dev runs locally in this browser.
        </h1>
        <p className="setup-copy">
          Confirm this browser can save project folders and run local AI providers before opening the
          editor.
        </p>
        <div className="setup-capability-list">
          <CapabilityRow capability={setupState.fileSystem} />
          <CapabilityRow capability={setupState.chromeTranslation} />
        </div>
        <div className="setup-actions">
          <button type="button" className="secondary-button" onClick={onRefresh}>
            Check again
          </button>
          <button type="button" className="primary-button" disabled={!canContinue} onClick={onContinue}>
            Continue to editor
          </button>
        </div>
      </section>
    </main>
  );
}
