import type { AuthoringOperationStatus } from '../../../services/automation/authoringOperationRegistry';

interface WebMcpOperationNoticeProps {
  status: AuthoringOperationStatus;
}

function formatStage(stage: string) {
  return stage.replaceAll('-', ' ');
}

export function WebMcpOperationNotice({ status }: WebMcpOperationNoticeProps) {
  const count =
    status.current !== undefined && status.total !== undefined
      ? `${status.current} of ${status.total}`
      : undefined;
  const terminal = status.state === 'completed' || status.state === 'failed';
  return (
    <aside
      aria-label="WebMCP authoring progress"
      className={`webmcp-operation-notice webmcp-operation-notice-${status.state}`}
      role="status"
      aria-live="polite"
    >
      <div className="webmcp-operation-notice-heading">
        <strong>{terminal ? `WebMCP ${status.state}` : 'WebMCP is working'}</strong>
        <span>{status.percentage}%</span>
      </div>
      <div
        aria-label={`${status.percentage}% complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={status.percentage}
        className="webmcp-operation-notice-track"
        role="progressbar"
      >
        <span style={{ width: `${status.percentage}%` }} />
      </div>
      <p>
        {formatStage(status.stage)}
        {count ? ` · ${count}` : ''}
        {status.detail ? ` · ${status.detail}` : ''}
      </p>
      {status.error ? <p className="webmcp-operation-notice-error">{status.error}</p> : null}
    </aside>
  );
}
