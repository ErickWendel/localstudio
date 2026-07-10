import type { OperationNoticeState } from '../state/useEditorViewModel';

interface ToolbarOperationNoticeProps {
  operationNotice: OperationNoticeState;
}

export function ToolbarOperationNotice({ operationNotice }: ToolbarOperationNoticeProps) {
  return (
    <div className={`operation-notice operation-notice-${operationNotice.tone}`} role="status">
      <span className="operation-notice-message">{operationNotice.message}</span>
      {operationNotice.detail ? (
        <span className="operation-notice-detail">{operationNotice.detail}</span>
      ) : null}
      {operationNotice.progress ? (
        <span
          className="operation-notice-progress"
          aria-label={`${operationNotice.progress.current} of ${operationNotice.progress.total}`}
        >
          <span
            className="operation-notice-progress-fill"
            style={{
              width: `${Math.round(
                (operationNotice.progress.current / operationNotice.progress.total) * 100,
              )}%`,
            }}
          />
        </span>
      ) : null}
    </div>
  );
}
