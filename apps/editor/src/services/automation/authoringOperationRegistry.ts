export type AuthoringOperationState = 'queued' | 'running' | 'completed' | 'failed';

export interface AuthoringOperationProgress {
  stage: string;
  progress: number;
  current?: number;
  total?: number;
  loadedBytes?: number;
  totalBytes?: number;
  detail?: string;
  warnings?: string[];
}

export interface AuthoringOperationStatus extends AuthoringOperationProgress {
  operationId: string;
  percentage: number;
  revision: number;
  state: AuthoringOperationState;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
  error?: string;
  result?: unknown;
}

type OperationTask = (
  report: (progress: Partial<AuthoringOperationProgress>) => void,
) => Promise<unknown>;

function createOperationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `operation-${crypto.randomUUID()}`;
  }
  return `operation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function cloneStatus(status: AuthoringOperationStatus): AuthoringOperationStatus {
  return {
    ...status,
    warnings: [...status.warnings],
  };
}

export class AuthoringOperationRegistry {
  private readonly operations = new Map<string, AuthoringOperationStatus>();

  start(stage: string, task: OperationTask): AuthoringOperationStatus {
    const operationId = createOperationId();
    const timestamp = new Date().toISOString();
    const status: AuthoringOperationStatus = {
      operationId,
      percentage: 0,
      revision: 0,
      state: 'queued',
      stage,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      warnings: [],
    };
    this.operations.set(operationId, status);

    void Promise.resolve().then(async () => {
      this.update(operationId, { state: 'running', progress: 1 });
      try {
        const result = await task((progress) => this.update(operationId, progress));
        this.update(operationId, {
          state: 'completed',
          stage: 'completed',
          progress: 100,
          result,
        });
      } catch (error) {
        this.update(operationId, {
          state: 'failed',
          stage: 'failed',
          error: error instanceof Error ? error.message : 'Authoring operation failed.',
        });
      }
    });

    return cloneStatus(status);
  }

  get(operationId: string): AuthoringOperationStatus | undefined {
    const status = this.operations.get(operationId);
    return status ? cloneStatus(status) : undefined;
  }

  private update(operationId: string, patch: Partial<AuthoringOperationStatus>) {
    const current = this.operations.get(operationId);
    if (!current) return;
    const progress =
      patch.progress === undefined
        ? current.progress
        : Math.max(current.progress, Math.min(100, Math.round(patch.progress)));
    this.operations.set(operationId, {
      ...current,
      ...patch,
      progress,
      percentage: progress,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      warnings: patch.warnings ? [...patch.warnings] : current.warnings,
    });
  }
}
