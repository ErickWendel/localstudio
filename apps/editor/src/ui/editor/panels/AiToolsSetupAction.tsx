import { DownloadCloud } from 'lucide-react';
import { useState } from 'react';

type AiToolsSetupTaskStatus = 'idle' | 'downloading' | 'failed' | 'ready';

interface AiToolsSetupTask {
  disabled?: boolean | undefined;
  id: string;
  label: string;
  onPrepare?: (() => Promise<void> | void) | undefined;
  status: AiToolsSetupTaskStatus;
}

interface AiToolsSetupActionProps {
  tasks: AiToolsSetupTask[];
}

function getPendingTasks(tasks: AiToolsSetupTask[]) {
  return tasks.filter(
    (task) =>
      !task.disabled && task.onPrepare && (task.status === 'idle' || task.status === 'failed'),
  );
}

function hasSetupWork(tasks: AiToolsSetupTask[]) {
  return tasks.some(
    (task) =>
      !task.disabled &&
      task.onPrepare &&
      (task.status === 'idle' || task.status === 'failed' || task.status === 'downloading'),
  );
}

function getSetupSummary(tasks: AiToolsSetupTask[], preparing: boolean) {
  const downloadingCount = tasks.filter((task) => task.status === 'downloading').length;
  const pendingCount = getPendingTasks(tasks).length;

  if (preparing || downloadingCount > 0) return 'Preparing required AI features...';
  if (pendingCount === 0) return 'AI features are ready.';
  return `${pendingCount} feature${pendingCount === 1 ? '' : 's'} need setup before the AI workflows feel instant.`;
}

export function AiToolsSetupAction({ tasks }: AiToolsSetupActionProps) {
  const [preparing, setPreparing] = useState(false);
  const pendingTasks = getPendingTasks(tasks);
  const visible = hasSetupWork(tasks);
  const disabled = preparing || pendingTasks.length === 0;
  const summary = getSetupSummary(tasks, preparing);

  if (!visible) return null;

  async function prepareAllFeatures() {
    setPreparing(true);
    try {
      for (const task of pendingTasks) {
        await task.onPrepare?.();
      }
    } finally {
      setPreparing(false);
    }
  }

  return (
    <section
      aria-label="AI feature setup"
      className="ai-setup-card ew-surface"
      data-tour-id="ai-feature-setup"
    >
      <div className="ai-setup-card-main">
        <DownloadCloud size={20} />
        <div>
          <h2>Prepare AI features</h2>
          <p>{summary}</p>
        </div>
      </div>
      <button
        className="ai-setup-button ew-focus-ring"
        disabled={disabled}
        type="button"
        onClick={() => {
          void prepareAllFeatures();
        }}
      >
        {preparing ? 'Preparing...' : pendingTasks.length === 0 ? 'Ready' : 'Download all'}
      </button>
    </section>
  );
}
