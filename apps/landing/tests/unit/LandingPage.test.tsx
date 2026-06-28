import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../../src/LandingPage';

describe('LandingPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ stargazers_count: 194166 }),
        }),
      ),
    );
  });

  afterEach(() => {
    document.getElementById('github-buttons-script')?.remove();
    vi.unstubAllGlobals();
  });

  it('introduces LocalStudio.ai as a local AI editor workflow', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: /Design slides with local AI/i })).toBeInTheDocument();
    expect(screen.getByText(/one continuous slide workflow/i)).toBeInTheDocument();
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Open editor/i })).toHaveAttribute('href', '/editor/');
  });

  it('keeps workflow steps product-focused instead of model-focused', () => {
    render(<LandingPage />);

    expect(screen.getByRole('tab', { name: /Prompt-to-slide/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Generate images/i })).toBeInTheDocument();
    expect(screen.queryByText('Chrome Prompt API')).not.toBeInTheDocument();
    expect(screen.queryByText('Bonsai Image WebGPU')).not.toBeInTheDocument();
  });

  it('lets people choose workflow demos from the hero carousel', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    const imageTab = screen.getByRole('tab', { name: /Generate images/i });
    await user.click(imageTab);

    expect(imageTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Create an image asset/i)).toBeInTheDocument();
  });

  it('promotes the GitHub repository with a custom star button and feature showcase sections', async () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: /Star LocalStudio.ai on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/ErickWendel/semana-javascript-expert07',
    );
    expect(screen.getByRole('link', { name: /Star LocalStudio.ai on GitHub/i })).toHaveClass('github-star-button');
    await waitFor(() => expect(screen.getByText('194,166')).toBeInTheDocument());
    expect(document.getElementById('github-buttons-script')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Every AI action returns to the editor/i })).toBeInTheDocument();
    expect(screen.getByText(/Project files, assets, and history stay in a folder/i)).toBeInTheDocument();
  });
});
