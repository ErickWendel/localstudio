import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingPage } from '../../src/LandingPage';

describe('LandingPage', () => {
  it('introduces LocalStudio.ai as a Web AI Canva alternative', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: /Design slides with Web AI/i })).toBeInTheDocument();
    expect(screen.getByText(/Canva alternative/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open editor/i })).toHaveAttribute('href', '/editor/');
  });

  it('keeps editor model dependencies visible as browser-side capabilities', () => {
    render(<LandingPage />);

    expect(screen.getByText('Chrome Prompt API')).toBeInTheDocument();
    expect(screen.getByText('Gemma 4 WebGPU')).toBeInTheDocument();
    expect(screen.getAllByText('Bonsai Image WebGPU')).toHaveLength(2);
  });
});
