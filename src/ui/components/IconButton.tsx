import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  children: ReactNode;
  active?: boolean;
  attention?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function IconButton({
  label,
  children,
  active = false,
  attention = false,
  disabled = false,
  onClick,
}: IconButtonProps) {
  const className = [
    'icon-button',
    active ? 'icon-button-active' : '',
    attention ? 'icon-button-attention' : '',
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
