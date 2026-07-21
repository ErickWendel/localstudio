import { localStudioAppRoutes } from '@localstudio/app-routes';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../../src/LandingPage';

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    stubReducedMotion(false);
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

    expect(
      screen.getByRole('heading', { name: /Design slides with local AI/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/one continuous slide workflow/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Google Slides\? Keynote\? Export as \.pptx/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('LocalStudio workflow path')).not.toBeInTheDocument();
    expect(screen.queryByText('Live editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Browser API')).not.toBeInTheDocument();
    const navigationLinks = within(
      screen.getByRole('navigation', { name: 'Landing sections' }),
    ).getAllByRole('link');
    expect(navigationLinks.map((link) => link.textContent)).toEqual([
      'About it',
      'Features',
      'Requirements',
      'Docs',
      'Pricing',
    ]);
    expect(screen.getByRole('link', { name: 'About it' })).toHaveAttribute('href', '#top');
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features');
    expect(screen.queryByRole('link', { name: 'WebMCP Showcase' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Requirements' })).toHaveAttribute(
      'href',
      '#requirements',
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      localStudioAppRoutes.docs.gettingStartedAnchor,
    );
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing');
    expect(screen.queryByRole('link', { name: 'Workflow' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'S3 Mirror' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Showcase' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Web AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Thanks' })).not.toBeInTheDocument();
    const openEditorLinks = screen.getAllByRole('link', { name: /Open editor/i });
    expect(openEditorLinks).toHaveLength(2);
    const heroOpenEditorLink = openEditorLinks[1]!;
    expect(heroOpenEditorLink).toHaveClass('header-cta');
    expect(heroOpenEditorLink).toHaveClass('hero-cta');
    expect(heroOpenEditorLink.querySelector('.hero-cta-snake')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Launch editor/i })).not.toBeInTheDocument();
  });

  it('marks the current landing section in the header nav without changing anchor destinations', () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: 'About it' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'About it' })).toHaveAttribute('href', '#top');
    expect(screen.getByRole('link', { name: 'Features' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Pricing' })).not.toHaveAttribute('aria-current');
  });

  it('adds scroll reveal contracts to hero, media, cards, and calls to action', () => {
    const { container } = render(<LandingPage />);

    expect(container.querySelector('[data-reveal="hero-copy"]')).toBeInTheDocument();
    expect(container.querySelector('[data-reveal="workflow-frame"]')).toBeInTheDocument();
    expect(container.querySelector('[data-reveal="showcase-heading"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-reveal="showcase-media"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-reveal="demo-card"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-reveal="web-ai-stack"]')).toBeInTheDocument();
    expect(container.querySelector('[data-reveal="webmcp-media"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-reveal="requirement-card"]').length).toBeGreaterThan(
      0,
    );
    expect(container.querySelector('[data-reveal="closing-cta"]')).toBeInTheDocument();
  });

  it('renders reveal content statically for reduced-motion users', () => {
    stubReducedMotion(true);
    const { container } = render(<LandingPage />);

    const revealElements = Array.from(container.querySelectorAll('[data-reveal]'));

    expect(revealElements.length).toBeGreaterThan(0);
    expect(
      revealElements.every((element) => element.getAttribute('data-reveal-state') === 'visible'),
    ).toBe(true);
    expect(revealElements.every((element) => element.classList.contains('is-visible'))).toBe(true);
  });

  it('adds product-surface motion affordances without new global decoration', () => {
    const { container } = render(<LandingPage />);

    expect(container.querySelector('.workflow-editor-cursor')).toBeInTheDocument();
    expect(container.querySelector('.workflow-selection-pulse')).toBeInTheDocument();
    expect(container.querySelectorAll('.feature-media-scanline').length).toBeGreaterThan(0);
    expect(container.querySelector('.feature-media-layer-pulse')).not.toBeInTheDocument();
    expect(container.querySelector('.webmcp-cursor-path')).toBeInTheDocument();
    expect(container.querySelectorAll('.requirement-status-check').length).toBeGreaterThan(0);
  });

  it('keeps workflow steps product-focused instead of model-focused', () => {
    render(<LandingPage />);

    const workflowTabs = screen.getAllByRole('tab');

    expect(screen.getByRole('tablist', { name: 'Choose workflow demo' })).toHaveClass(
      'workflow-tabs--stair',
    );
    expect(workflowTabs.every((tab) => tab.classList.contains('workflow-tab'))).toBe(true);
    expect(workflowTabs).toHaveLength(7);
    expect(workflowTabs[0]).toHaveTextContent(/Bring your own PPT/i);
    expect(workflowTabs[5]).toHaveTextContent(/Present with confidence/i);
    expect(workflowTabs[6]).toHaveTextContent(/Share your presentation/i);
    expect(screen.getByRole('tab', { name: /Bring your own PPT/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Prompt-to-slide/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Prompt-to-image/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Translate/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Work locally/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Share your presentation/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Present with confidence/i })).toBeInTheDocument();
    expect(screen.queryByText('Chrome Prompt API')).not.toBeInTheDocument();
    expect(screen.queryByText('Bonsai Image WebGPU')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Share your slides' })).toBeInTheDocument();
    expect(screen.getByText(/use your own external storage/i)).toBeInTheDocument();
    expect(screen.getByText(/reimport it into different machines/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Remove backgrounds' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit images' })).toBeInTheDocument();
    expect(screen.getByLabelText('Watch workflow steps')).toHaveClass('demo-grid--stair');
  });

  it('lets people choose workflow demos from the hero carousel', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    const pptTab = screen.getByRole('tab', { name: /Bring your own PPT/i });
    await user.click(pptTab);

    expect(pptTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Import an existing \.pptx file/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Bring your own PPT workflow/i).querySelector('source'),
    ).toHaveAttribute('src', '/demo-bring-your-ppt.mp4');

    const promptTab = screen.getByRole('tab', { name: /Prompt-to-slide/i });
    await user.click(promptTab);

    expect(promptTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByLabelText(/Prompt-to-slide workflow/i).querySelector('source'),
    ).toHaveAttribute('src', '/demo-prompt-to-slides.mp4');
    expect(screen.getByLabelText(/Prompt-to-slide workflow/i)).toHaveAttribute(
      'preload',
      'metadata',
    );

    const imageTab = screen.getByRole('tab', { name: /Prompt-to-image/i });
    await user.click(imageTab);

    expect(imageTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/A prompt becomes an image asset/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Prompt-to-image workflow/i).querySelector('source'),
    ).toHaveAttribute('src', '/demo-prompt-to-image.mp4');

    const translateTab = screen.getByRole('tab', { name: /Translate/i });
    await user.click(translateTab);

    expect(translateTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Translate workflow/i).querySelector('source')).toHaveAttribute(
      'src',
      '/demo-translate.mp4',
    );

    const localTab = screen.getByRole('tab', { name: /Work locally/i });
    await user.click(localTab);

    expect(localTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Work locally workflow/i).querySelector('source')).toHaveAttribute(
      'src',
      '/demo-work-locally.mp4',
    );

    const shareTab = screen.getByRole('tab', { name: /Share your presentation/i });
    await user.click(shareTab);

    expect(shareTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByLabelText(/Share presentation workflow/i).querySelector('source'),
    ).toHaveAttribute('src', '/demo-share-presentation.mp4');

    const presentTab = screen.getByRole('tab', { name: /Present with confidence/i });
    await user.click(presentTab);

    expect(presentTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByLabelText(/Present with confidence workflow/i).querySelector('source'),
    ).toHaveAttribute('src', '/demo-present-with-confidence.mp4');
  });

  it('automatically advances workflow demos when the active video finishes', () => {
    render(<LandingPage />);

    fireEvent.click(screen.getByRole('tab', { name: /Bring your own PPT/i }));

    expect(screen.getByRole('tab', { name: /Bring your own PPT/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.ended(screen.getByLabelText(/Bring your own PPT workflow/i));

    expect(screen.getByRole('tab', { name: /Prompt-to-slide/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.ended(screen.getByLabelText(/Prompt-to-slide workflow/i));

    expect(screen.getByRole('tab', { name: /Prompt-to-image/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.ended(screen.getByLabelText(/Prompt-to-image workflow/i));

    expect(screen.getByRole('tab', { name: /Translate/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('does not auto-advance workflow demos for reduced-motion users', () => {
    stubReducedMotion(true);
    render(<LandingPage />);

    fireEvent.click(screen.getByRole('tab', { name: /Prompt-to-slide/i }));

    expect(screen.getByRole('tab', { name: /Prompt-to-slide/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('9999 GitHub stars')).toHaveTextContent('9999');

    fireEvent.ended(screen.getByLabelText(/Prompt-to-slide workflow/i));

    expect(screen.getByRole('tab', { name: /Prompt-to-slide/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText(/Prompt-to-slide workflow/i)).not.toHaveAttribute('autoplay');
  });

  it('explains S3-compatible mirroring as the bridge from local projects to public links', () => {
    render(<LandingPage />);

    const showcaseSection = screen
      .getByRole('heading', { name: /Every AI action returns to the editor/i })
      .closest('section');
    if (!showcaseSection) {
      throw new Error('Feature showcase section was not rendered.');
    }

    expect(
      within(showcaseSection).getByRole('heading', {
        name: /S3-compatible projects can still publish public links/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(showcaseSection).getByText(/MinIO works as the local\/self-hosted example/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/AWS S3, R2, or any compatible endpoint/i)).toBeInTheDocument();
    expect(
      within(showcaseSection).getByText(
        /mirror local fonts so shared decks keep their typography for viewers/i,
      ),
    ).toBeInTheDocument();
    expect(within(showcaseSection).getByText('Project JSON and assets')).toBeInTheDocument();
    expect(within(showcaseSection).getByText('Version history and config')).toBeInTheDocument();
    expect(
      within(showcaseSection).getByText('Public share payloads with mirrored fonts'),
    ).toBeInTheDocument();
    expect(
      within(showcaseSection).getByRole('img', {
        name: /S3-compatible mirror settings beside a MinIO object browser/i,
      }),
    ).toHaveAttribute('src', '/s3-compatible-showcase.png');
    expect(screen.queryByLabelText('Local-to-public S3 mirror flow')).not.toBeInTheDocument();
  });

  it('features PowerPoint import first and uses media for the S3 project feature', () => {
    render(<LandingPage />);

    const featuresSection = screen
      .getByRole('heading', { name: /Every AI action returns to the editor/i })
      .closest('section');
    if (!featuresSection) {
      throw new Error('Feature showcase section was not rendered.');
    }
    const showcaseHeadings = within(featuresSection).getAllByRole('heading', { level: 3 });

    expect(showcaseHeadings[0]).toHaveTextContent(
      /Bring your existing presentations to LocalStudio/i,
    );
    expect(showcaseHeadings[1]).toHaveTextContent(/Present with confidence from LocalStudio/i);
    expect(showcaseHeadings[5]).toHaveTextContent(
      /Project files, assets, and history stay in a folder/i,
    );
    expect(showcaseHeadings[6]).toHaveTextContent(
      /S3-compatible projects can still publish public links/i,
    );
    expect(showcaseHeadings[7]).toHaveTextContent(
      /Use segmentation tools like normal editor actions/i,
    );
    expect(within(featuresSection).getByText(/Google Slides\? Keynote\?/i)).toBeInTheDocument();
    expect(
      within(featuresSection).getByText(/Export as \.pptx and import into LocalStudio/i),
    ).toBeInTheDocument();
    expect(
      within(featuresSection).getByRole('img', {
        name: /editor importing a PowerPoint presentation/i,
      }),
    ).toHaveAttribute('src', '/bring-your-own-ppt-showcase.png');
    expect(
      within(featuresSection).getByRole('heading', {
        name: /Present with confidence from LocalStudio/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(featuresSection).getByText(/companion PWA can remotely control the presentation/i),
    ).toBeInTheDocument();
    expect(within(featuresSection).getByText('Speaker timer and notes')).toBeInTheDocument();
    expect(
      within(featuresSection).getByText('Next and previous slide controls'),
    ).toBeInTheDocument();
    expect(within(featuresSection).getByText('PWA remote control over P2P')).toBeInTheDocument();
    expect(
      within(featuresSection).getByRole('img', {
        name: /presenter mode with speaker notes and phone remote controls/i,
      }),
    ).toHaveAttribute('src', '/present-with-confidence-showcase.png');
    expect(
      showcaseHeadings.some((heading) => /S3-compatible projects/i.test(heading.textContent ?? '')),
    ).toBe(true);
    expect(
      within(featuresSection).getByRole('img', {
        name: /S3-compatible mirror settings beside a MinIO object browser/i,
      }),
    ).toHaveAttribute('src', '/s3-compatible-showcase.png');
    expect(
      within(featuresSection).getByRole('img', {
        name: /translate menu selecting Portuguese as the target language/i,
      }),
    ).toHaveAttribute('src', '/translate-showcase-editor.png');
    expect(screen.queryByLabelText('Local-to-public S3 mirror flow')).not.toBeInTheDocument();
  });

  it('renders the S3 mirror media for reduced-motion users', () => {
    stubReducedMotion(true);
    render(<LandingPage />);

    expect(
      screen.getAllByRole('img', {
        name: /S3-compatible mirror settings beside a MinIO object browser/i,
      }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('img', {
        name: /S3-compatible mirror settings beside a MinIO object browser/i,
      }),
    ).toHaveAttribute('src', '/s3-compatible-showcase.png');
  });

  it('promotes the GitHub repository with a custom star button and feature showcase sections', () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: /Star LocalStudio.dev on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/ErickWendel/localstudio',
    );
    expect(screen.getByRole('link', { name: /Star LocalStudio.dev on GitHub/i })).toHaveClass(
      'github-star-button',
    );
    expect(screen.getByLabelText('9999 GitHub stars')).toBeInTheDocument();
    expect(document.getElementById('github-buttons-script')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Every AI action returns to the editor/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /prompt-to-slide editor/i })).toHaveAttribute(
      'src',
      '/prompt-to-slide-showcase.png',
    );
    expect(screen.getByRole('img', { name: /prompt-to-slide editor/i })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.getByRole('img', { name: /prompt-to-slide editor/i })).toHaveAttribute(
      'decoding',
      'async',
    );
    expect(screen.getByRole('img', { name: /generated AI chip image/i })).toHaveAttribute(
      'src',
      '/prompt-to-image-showcase.png',
    );
    expect(
      screen.getByRole('img', { name: /translate menu selecting Portuguese/i }),
    ).toHaveAttribute('src', '/translate-showcase-editor.png');
    expect(screen.getByRole('img', { name: /background removal segmentation/i })).toHaveAttribute(
      'src',
      '/edit-images-showcase.png',
    );
    expect(screen.getByRole('img', { name: /project history panel/i })).toHaveAttribute(
      'src',
      '/project-history-showcase.png',
    );
    expect(
      screen.getByText(/Project files, assets, and history stay in a folder/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Built for modern browser AI workflows/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /A host page can drive the editor/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /WebMCP showcase page/i })).toHaveAttribute(
      'src',
      '/webmcp-showcase.png',
    );
    expect(screen.getByRole('img', { name: /WebMCP showcase page/i })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.getByRole('img', { name: /WebMCP showcase page/i })).toHaveAttribute(
      'decoding',
      'async',
    );
    expect(screen.getByRole('link', { name: /Open WebMCP demo/i })).toHaveAttribute(
      'href',
      '/editor/webmcp',
    );
    expect(screen.getByRole('heading', { name: 'Chrome browser' })).toBeInTheDocument();
    expect(screen.getByText(/10GB free storage/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Built on the work of the browser AI community/i }),
    ).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/erickWendel',
    );
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
