import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  children: ReactNode;
  active?: boolean;
  attention?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  onClick?: () => void;
}

export function IconButton({
  label,
  children,
  active = false,
  attention = false,
  disabled = false,
  tone = 'default',
  onClick,
}: IconButtonProps) {
  const className = [
    'icon-button',
    'ew-icon-control',
    'ew-focus-ring',
    active ? 'icon-button-active' : '',
    attention ? 'icon-button-attention' : '',
    tone === 'danger' ? 'icon-button-danger' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={className}
      type="button"
    >
      {children}
    </button>
  );
}
