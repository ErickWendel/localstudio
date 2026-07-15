import { DownloadCloud } from 'lucide-react';
import { useState } from 'react';

type AiToolsSetupTaskStatus = 'idle' | 'downloading' | 'failed' | 'ready';

interface AiToolsSetupTask {
  disabled?: boolean | undefined;
  id: string;
  label: string;
  onPrepare?: (() => Promise<void> | void) | undefined;
  progress: number;
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

  if (preparing || downloadingCount > 0) return 'Downloading required AI features...';
  if (pendingCount === 0) return 'AI features are ready.';
  return `${pendingCount} feature${pendingCount === 1 ? '' : 's'} need setup before the AI workflows feel instant.`;
}

function getVisibleTasks(tasks: AiToolsSetupTask[]) {
  return tasks.filter(
    (task) =>
      !task.disabled &&
      task.onPrepare &&
      (task.status === 'idle' || task.status === 'failed' || task.status === 'downloading'),
  );
}

function getTaskStatusLabel(status: AiToolsSetupTaskStatus) {
  if (status === 'downloading') return 'Downloading';
  if (status === 'failed') return 'Failed';
  if (status === 'ready') return 'Ready';
  return 'Pending';
}

function getTaskProgress(task: AiToolsSetupTask) {
  if (task.status === 'ready') return 100;
  return Math.max(0, Math.min(100, Math.round(task.progress)));
}

export function AiToolsSetupAction({ tasks }: AiToolsSetupActionProps) {
  const [preparing, setPreparing] = useState(false);
  const pendingTasks = getPendingTasks(tasks);
  const visibleTasks = getVisibleTasks(tasks);
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
        {preparing ? 'Downloading...' : pendingTasks.length === 0 ? 'Ready' : 'Download all'}
      </button>
      {visibleTasks.length > 0 ? (
        <div className="ai-setup-task-list" aria-label="AI feature download progress">
          {visibleTasks.map((task) => {
            const progress = getTaskProgress(task);
            return (
              <div className="ai-setup-task" key={task.id}>
                <div className="ai-setup-task-meta">
                  <span>{task.label}</span>
                  <strong>
                    {getTaskStatusLabel(task.status)}
                    {task.status === 'downloading' ? ` ${progress}%` : ''}
                  </strong>
                </div>
                <div
                  aria-label={`${task.label} download progress`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={progress}
                  className="model-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
