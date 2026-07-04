interface StatusPillProps {
  label: string;
  tone?: 'neutral' | 'success' | 'warning';
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const statusClass = tone === 'neutral' ? 'ew-status-muted' : `ew-status-${tone}`;
  return <span className={`status-pill status-pill-${tone} ${statusClass}`}>{label}</span>;
}
