import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function IconButton({ label, children, active = false, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={active ? 'icon-button icon-button-active' : 'icon-button'}
      type="button"
    >
      {children}
    </button>
  );
}
