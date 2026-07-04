import type { ReactNode } from 'react';

interface PanelSectionProps {
  title: string;
  children: ReactNode;
}

export function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <section className="panel-section ew-panel-card">
      <h3 className="panel-section-title">{title}</h3>
      {children}
    </section>
  );
}
