import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('introduces LocalStudio.dev as a local AI editor workflow', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: /Design slides with local AI/i })).toBeInTheDocument();
    expect(screen.getByText(/one continuous slide workflow/i)).toBeInTheDocument();
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('href', '#top');
    expect(screen.getByRole('link', { name: 'Showcase' })).toHaveAttribute('href', '#showcase');
    expect(screen.getByRole('link', { name: 'Web AI' })).toHaveAttribute('href', '#web-ai');
    expect(screen.getByRole('link', { name: 'WebMCP' })).toHaveAttribute('href', '#webmcp');
    expect(screen.getByRole('link', { name: 'Editor' })).toHaveAttribute('href', '#features');
    expect(screen.getByRole('link', { name: 'Requirements' })).toHaveAttribute('href', '#requirements');
    expect(screen.getByRole('link', { name: 'Thanks' })).toHaveAttribute('href', '#thanks');
    expect(screen.getByRole('link', { name: /Open editor/i })).toHaveAttribute('href', '/editor/');
  });

  it('keeps workflow steps product-focused instead of model-focused', () => {
    render(<LandingPage />);

    expect(screen.getByRole('tab', { name: /Prompt-to-slide/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Prompt-to-image/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Powered by Web AI/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Prompt-to-slide workflow/i).querySelector('source')).toHaveAttribute(
      'src',
      '/prompt-to-slide.mp4',
    );
    expect(screen.queryByText('Chrome Prompt API')).not.toBeInTheDocument();
    expect(screen.queryByText('Bonsai Image WebGPU')).not.toBeInTheDocument();
  });

  it('lets people choose workflow demos from the hero carousel', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    const imageTab = screen.getByRole('tab', { name: /Prompt-to-image/i });
    await user.click(imageTab);

    expect(imageTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/A prompt becomes an image asset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prompt-to-image workflow/i).querySelector('source')).toHaveAttribute(
      'src',
      '/prompt-to-image.mp4',
    );

    const translateTab = screen.getByRole('tab', { name: /Translate/i });
    await user.click(translateTab);

    expect(translateTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Translate workflow/i).querySelector('source')).toHaveAttribute('src', '/translate.mp4');

    const editTab = screen.getByRole('tab', { name: /Edit images/i });
    await user.click(editTab);

    expect(editTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Edit images workflow/i).querySelector('source')).toHaveAttribute(
      'src',
      '/edit-images.mp4',
    );

    const localTab = screen.getByRole('tab', { name: /Work locally/i });
    await user.click(localTab);

    expect(localTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Work locally workflow/i).querySelector('source')).toHaveAttribute(
      'src',
      '/fs-history.mp4',
    );

    const webAiTab = screen.getByRole('tab', { name: /Powered by Web AI/i });
    await user.click(webAiTab);

    expect(webAiTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Powered by Web AI workflow/i).querySelector('source')).toHaveAttribute(
      'src',
      '/powered-webau.mp4',
    );
  });

  it('automatically advances workflow demos when the active video finishes', () => {
    render(<LandingPage />);

    expect(screen.getByRole('tab', { name: /Prompt-to-slide/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.ended(screen.getByLabelText(/Prompt-to-slide workflow/i));

    expect(screen.getByRole('tab', { name: /Prompt-to-image/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.ended(screen.getByLabelText(/Prompt-to-image workflow/i));

    expect(screen.getByRole('tab', { name: /Translate/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('promotes the GitHub repository with a custom star button and feature showcase sections', async () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: /Star LocalStudio.dev on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/ErickWendel/localstudio',
    );
    expect(screen.getByRole('link', { name: /Star LocalStudio.dev on GitHub/i })).toHaveClass('github-star-button');
    await waitFor(() => expect(screen.getByText('194,166')).toBeInTheDocument());
    expect(document.getElementById('github-buttons-script')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Every AI action returns to the editor/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /prompt-to-slide editor/i })).toHaveAttribute(
      'src',
      '/prompt-to-slide-showcase.png',
    );
    expect(screen.getByRole('img', { name: /generated AI chip image/i })).toHaveAttribute(
      'src',
      '/prompt-to-image-showcase.png',
    );
    expect(screen.getByRole('img', { name: /translated into Portuguese/i })).toHaveAttribute(
      'src',
      '/translate-showcase.png',
    );
    expect(screen.getByRole('img', { name: /background removal segmentation/i })).toHaveAttribute(
      'src',
      '/edit-images-showcase.png',
    );
    expect(screen.getByRole('img', { name: /project history panel/i })).toHaveAttribute(
      'src',
      '/project-history-showcase.png',
    );
    expect(screen.getByText(/Project files, assets, and history stay in a folder/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Built for modern browser AI workflows/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /A host page can drive the editor/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /WebMCP showcase page/i })).toHaveAttribute(
      'src',
      '/webmcp-showcase.png',
    );
    expect(screen.getByRole('link', { name: /Open WebMCP demo/i })).toHaveAttribute('href', '/webmcp/');
    expect(screen.getByRole('heading', { name: 'Chrome browser' })).toBeInTheDocument();
    expect(screen.getByText(/10GB free storage/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Built on the work of the browser AI community/i })).toBeInTheDocument();
    expect(screen.getByText(/Chrome Web Team/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Chrome Built-in AI/i })).toHaveAttribute(
      'href',
      'https://developer.chrome.com/docs/ai/built-in?utm_source=localstudio.dev&utm_medium=referral&utm_campaign=localstudio_thanks',
    );
    expect(screen.getByRole('link', { name: /Hugging Face WebML community/i })).toHaveAttribute(
      'href',
      'https://huggingface.co/webml-community?utm_source=localstudio.dev&utm_medium=referral&utm_campaign=localstudio_thanks',
    );
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/@ErickWendelAcademy',
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/erickWendel');
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/erickwendel/',
    );
    expect(screen.getByRole('link', { name: /Star the repo/i })).toHaveAttribute(
      'href',
      'https://github.com/ErickWendel/localstudio',
    );
  });
});
