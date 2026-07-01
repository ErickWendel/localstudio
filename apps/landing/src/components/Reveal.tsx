import { createElement, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

type RevealStyle = CSSProperties & { '--reveal-delay'?: string };

type RevealProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delay?: number;
  reveal: string;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'style'>;

export function Reveal({ as = 'div', children, className, delay = 0, reveal, ...props }: RevealProps) {
  const { elementRef, isVisible } = useScrollReveal();
  const revealClassName = [className, isVisible ? 'is-visible' : undefined].filter(Boolean).join(' ');
  const style: RevealStyle = { '--reveal-delay': `${delay}ms` };

  return createElement(
    as,
    {
      ...props,
      className: revealClassName,
      'data-reveal': reveal,
      'data-reveal-state': isVisible ? 'visible' : 'hidden',
      ref: elementRef,
      style,
    },
    children,
  );
}
