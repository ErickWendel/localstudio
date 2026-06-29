import { type CSSProperties, useEffect, useState } from 'react';
import {
  ArrowRight,
  AppWindow,
  Bot,
  BrainCircuit,
  Eraser,
  ExternalLink,
  FolderOpen,
  HardDrive,
  ImagePlus,
  Languages,
  Layers3,
  Lock,
  Sparkles,
  Star,
} from 'lucide-react';

type WorkflowStepId = 'prompt' | 'image' | 'translate' | 'edit' | 'local' | 'webai';
type FeatureShowcaseId = Exclude<WorkflowStepId, 'webai'>;
type FeatureMediaStyle = CSSProperties & { '--feature-media-ratio'?: string };

const githubUrl = 'https://github.com/ErickWendel/localstudio';
const githubApiUrl = 'https://api.github.com/repos/ErickWendel/localstudio';
const chromeBuiltInAiUrl =
  'https://developer.chrome.com/docs/ai/built-in?utm_source=localstudio.dev&utm_medium=referral&utm_campaign=localstudio_thanks';
const huggingFaceWebMlUrl =
  'https://huggingface.co/webml-community?utm_source=localstudio.dev&utm_medium=referral&utm_campaign=localstudio_thanks';

const socialLinks = [
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@ErickWendelAcademy',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/erickWendel',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/erickwendel/',
  },
];
const workflowDemoVideos: Record<WorkflowStepId, { src: string; fallbackSrc: string; label: string }> = {
  prompt: {
    src: '/prompt-to-slide.mp4',
    fallbackSrc: '/prompt-to-slide.gif',
    label: 'Prompt-to-slide workflow generating an editable presentation in LocalStudio',
  },
  image: {
    src: '/prompt-to-image.mp4',
    fallbackSrc: '/prompt-to-image.gif',
    label: 'Prompt-to-image workflow generating an image and continuing the slide in LocalStudio',
  },
  translate: {
    src: '/translate.mp4',
    fallbackSrc: '/translate.gif',
    label: 'Translate workflow updating slide text in LocalStudio',
  },
  edit: {
    src: '/edit-images.mp4',
    fallbackSrc: '/edit-images.gif',
    label: 'Edit images workflow removing backgrounds and adjusting image layers in LocalStudio',
  },
  local: {
    src: '/fs-history.mp4',
    fallbackSrc: '/fs-history.gif',
    label: 'Work locally workflow saving with the File System Access API and browsing project history in LocalStudio',
  },
  webai: {
    src: '/powered-webau.mp4',
    fallbackSrc: '/powered-webau.gif',
    label: 'Powered by Web AI workflow showing browser-native AI capabilities in LocalStudio',
  },
};

const workflowSteps: Array<{
  id: WorkflowStepId;
  icon: typeof BrainCircuit;
  title: string;
  copy: string;
}> = [
  {
    id: 'prompt',
    icon: BrainCircuit,
    title: 'Prompt-to-slide',
    copy: 'A prompt becomes editable slide layers, not a flat generated image.',
  },
  {
    id: 'image',
    icon: ImagePlus,
    title: 'Prompt-to-image',
    copy: 'A prompt becomes an image asset while you keep composing the same slide.',
  },
  {
    id: 'translate',
    icon: Languages,
    title: 'Translate',
    copy: 'Translate selected text, one page, or the full deck in place.',
  },
  {
    id: 'edit',
    icon: Eraser,
    title: 'Edit images',
    copy: 'Remove the background, then flip or expand the image as a normal layer.',
  },
  {
    id: 'local',
    icon: FolderOpen,
    title: 'Work locally',
    copy: 'Save project files to disk and restore from local version history.',
  },
  {
    id: 'webai',
    icon: Sparkles,
    title: 'Powered by Web AI',
    copy: 'Browser-native AI capabilities keep the workflow fast, private, and local-first.',
  },
];

const featureMediaImages: Partial<Record<FeatureShowcaseId, { src: string; alt: string; aspectRatio: string }>> = {
  prompt: {
    src: '/prompt-to-slide-showcase.png',
    alt: 'LocalStudio prompt-to-slide editor with an AI Design Revolution slide',
    aspectRatio: '2982 / 2390',
  },
  image: {
    src: '/prompt-to-image-showcase.png',
    alt: 'LocalStudio prompt-to-image editor with a generated AI chip image on a slide',
    aspectRatio: '2970 / 2398',
  },
  translate: {
    src: '/translate-showcase.png',
    alt: 'LocalStudio translate editor showing the AI Design Revolution slide translated into Portuguese',
    aspectRatio: '2980 / 2396',
  },
  edit: {
    src: '/edit-images-showcase.png',
    alt: 'LocalStudio edit images workflow showing background removal segmentation on an image layer',
    aspectRatio: '2982 / 2396',
  },
  local: {
    src: '/project-history-showcase.png',
    alt: 'LocalStudio project history panel showing saved local versions',
    aspectRatio: '4110 / 2402',
  },
};

const featureShowcases: Array<{
  id: FeatureShowcaseId;
  eyebrow: string;
  title: string;
  copy: string;
  bullets: string[];
}> = [
  {
    id: 'prompt',
    eyebrow: 'Prompt-to-slide',
    title: 'Generate a real slide structure, then keep editing every layer.',
    copy: 'The prompt flow creates editable text, image, and shape layers on the active page instead of locking the result into one flat bitmap.',
    bullets: ['Structured JSON slide tasks', 'Progressive layer updates', 'Konva-ready editable objects'],
  },
  {
    id: 'image',
    eyebrow: 'Prompt-to-image',
    title: 'Create image assets without leaving the deck.',
    copy: 'Prompt-to-image is part of the same prompt surface, so a generated asset lands back on the canvas as a normal editable layer.',
    bullets: ['Image prompts inside the prompt bar', 'Size, steps, and seed controls', 'Generated assets saved locally'],
  },
  {
    id: 'translate',
    eyebrow: 'Translate',
    title: 'Translate selected text, the current page, or the whole deck.',
    copy: 'Translation stays inside the editor context with target-language setup and layout-preserving text updates.',
    bullets: ['Target language control', 'Language detection', 'Selected text, page, or deck scopes'],
  },
  {
    id: 'edit',
    eyebrow: 'Edit images',
    title: 'Use segmentation tools like normal editor actions.',
    copy: 'Background removal, flip, and crop sit next to ordinary layer controls so AI image editing feels like part of the canvas.',
    bullets: ['Click-guided subject selection', 'Blue mask preview', 'Flip and crop after extraction'],
  },
  {
    id: 'local',
    eyebrow: 'Work locally',
    title: 'Project files, assets, and history stay in a folder you control.',
    copy: 'The editor is local-first: project JSON, assets, cache, and version snapshots live on disk while model weights stay in browser-managed caches.',
    bullets: ['File System Access API', 'Local version history', 'No account or cloud workspace required'],
  },
];

const demoSteps = [
  {
    icon: BrainCircuit,
    title: 'Prompt to slides',
    copy: 'Turn a plain-language request into Konva-ready slide objects with structured JSON.',
    proof: 'Editable slide layers',
  },
  {
    icon: Languages,
    title: 'Translate the deck',
    copy: 'Translate one text layer, one page, or the whole deck while preserving layout intent.',
    proof: 'In-place text updates',
  },
  {
    icon: Eraser,
    title: 'Remove backgrounds',
    copy: 'Click the subject, preview the segment mask, and keep refining before cutting.',
    proof: 'Canvas image action',
  },
  {
    icon: ImagePlus,
    title: 'Create images',
    copy: 'Generate an asset from the prompt bar and drop it directly into the active slide.',
    proof: 'Normal image layer',
  },
  {
    icon: FolderOpen,
    title: 'Save local projects',
    copy: 'Store metadata and assets in a folder you control instead of a remote workspace.',
    proof: 'Local project files',
  },
];

const editorProof = [
  'Layered slide canvas',
  'Pages, thumbnails, and drag reordering',
  'Text toolbar with translate actions',
  'PNG export and local folder persistence',
];

const requirements: Array<{
  icon: typeof BrainCircuit;
  title: string;
  copy: string;
}> = [
  {
    icon: AppWindow,
    title: 'Chrome browser',
    copy: 'Preferred browser because LocalStudio uses Chrome-first browser AI and file system APIs as they become available.',
  },
  {
    icon: HardDrive,
    title: '10GB free storage',
    copy: 'Recommended minimum for downloaded model weights, browser-managed caches, generated assets, and local project history.',
  },
];

function formatStarCount(stars: number) {
  return new Intl.NumberFormat('en-US').format(stars);
}

function GitHubLogo() {
  return (
    <svg className="github-logo" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.7 5.47 7.78.4.07.55-.18.55-.39 0-.2-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.15-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.1-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.4 7.4 0 0 1 8 3.99c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.75.54 1.52 0 1.1-.01 1.98-.01 2.25 0 .21.15.47.55.39A8.13 8.13 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"
      />
    </svg>
  );
}

function GitHubStarButton() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    if (typeof fetch !== 'function') {
      return;
    }

    const controller = new AbortController();

    fetch(githubApiUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { stargazers_count?: number } | null) => {
        if (typeof data?.stargazers_count === 'number') {
          setStars(data.stargazers_count);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <a
      className="github-star-button"
      href={githubUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Star LocalStudio.dev on GitHub"
    >
      <GitHubLogo />
      <span className="github-star-divider" aria-hidden="true" />
      <span className="github-star-count">{stars === null ? 'Star' : formatStarCount(stars)}</span>
    </a>
  );
}

function FooterStarCta() {
  return (
    <a className="footer-star-cta" href={githubUrl} target="_blank" rel="noreferrer">
      <Star size={18} aria-hidden="true" />
      Star the repo
      <ArrowRight size={16} aria-hidden="true" />
    </a>
  );
}

function FeatureMedia({ feature }: { feature: FeatureShowcaseId }) {
  const mediaImage = featureMediaImages[feature];
  const mediaImageStyle: FeatureMediaStyle | undefined = mediaImage
    ? { '--feature-media-ratio': mediaImage.aspectRatio }
    : undefined;

  return (
    <div
      className={mediaImage ? 'feature-media with-image' : 'feature-media'}
      data-feature={feature}
      aria-label={`${feature} feature preview`}
    >
      {mediaImage ? null : (
        <div className="feature-media-toolbar">
          <span>LocalStudio.dev</span>
          <strong>{feature}</strong>
        </div>
      )}
      <div className="feature-media-canvas" style={mediaImageStyle}>
        {mediaImage ? <img className="feature-media-image" src={mediaImage.src} alt={mediaImage.alt} /> : null}
        <span className="media-page page-one" />
        <span className="media-page page-two" />
        <span className="media-object object-one" />
        <span className="media-object object-two" />
        <span className="media-object object-three" />
        <span className="media-selection" />
        <span className="media-progress" />
        <span className="media-caption caption-one">Editable layer</span>
        <span className="media-caption caption-two">Local history</span>
      </div>
    </div>
  );
}

function WorkflowPreview({ activeStep, onDemoEnded }: { activeStep: WorkflowStepId; onDemoEnded: () => void }) {
  const demoVideo = workflowDemoVideos[activeStep];

  return (
    <div className="workflow-preview" data-demo={activeStep} aria-label="LocalStudio workflow preview">
      <div className="preview-topbar">
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <strong>Launch deck.localstudio</strong>
        <span className="preview-pill">Local models ready</span>
      </div>
      <div className="preview-body">
        <aside className="preview-rail" aria-hidden="true">
          <span>Layout</span>
          <span>Text</span>
          <span>AI Tools</span>
          <span>Assets</span>
        </aside>
        <div className="preview-workspace">
          <div className="floating-toolbar">
            <span>Move</span>
            <span>Crop</span>
            <span>Flip</span>
            <span>Translate</span>
          </div>
          <div className="preview-slide">
            <video
              key={demoVideo.src}
              className="workflow-demo-video"
              aria-label={demoVideo.label}
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={onDemoEnded}
            >
              <source src={demoVideo.src} type="video/mp4" />
              <a href={demoVideo.fallbackSrc}>View the workflow demo</a>
            </video>
            <div className="slide-grid" />
            <div className="generated-shape shape-a" />
            <div className="generated-shape shape-b" />
            <div className="generated-image">
              <span className="image-sky" />
              <span className="image-glow" />
              <span className="image-subject" />
              <span className="mask-outline" />
            </div>
            <div className="slide-copy original-copy">
              <strong>Web AI launch plan</strong>
              <span>Generate a product story, create assets, translate, and save locally.</span>
            </div>
            <div className="slide-copy translated-copy">
              <strong>Plano de lancamento Web AI</strong>
              <span>Gere a historia do produto, crie imagens, traduza e salve localmente.</span>
            </div>
            <div className="generation-progress">
              <span />
              Generating editable layers...
            </div>
            <div className="folder-card">
              <FolderOpen size={18} aria-hidden="true" />
              <div>
                <strong>Local project folder</strong>
                <span>project.json, assets, history</span>
              </div>
            </div>
          </div>
          <div className="prompt-dock">
            <span>+</span>
            <p>
              Create a launch slide for a browser-native AI editor, then generate the hero image.
            </p>
            <button type="button">Run</button>
          </div>
        </div>
        <aside className="preview-pages" aria-hidden="true">
          <span className="page-thumb active" />
          <span className="page-thumb" />
          <span className="page-thumb" />
          <div className="history-stack">
            <strong>History</strong>
            <span>14:42 Image layer</span>
            <span>14:44 Translate slide</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MotionBackdrop() {
  return (
    <div className="motion-backdrop" aria-hidden="true">
      <div className="motion-grid" />
      <div className="motion-scan motion-scan-primary" />
      <div className="motion-scan motion-scan-secondary" />
      <div className="motion-data-field">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function LandingPage() {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStepId>('prompt');
  const activeWorkflow = workflowSteps.find((step) => step.id === activeWorkflowStep) ?? workflowSteps[0]!;

  const advanceWorkflowStep = () => {
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      return;
    }

    setActiveWorkflowStep((currentStep) => {
      const currentIndex = workflowSteps.findIndex((step) => step.id === currentStep);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % workflowSteps.length;
      return workflowSteps[nextIndex]!.id;
    });
  };

  return (
    <main className="landing-shell">
      <MotionBackdrop />
      <header className="landing-header">
        <a className="brand-mark" href="#top" aria-label="LocalStudio.dev beta home">
          LocalStudio.dev
          <span className="beta-flag">Beta</span>
        </a>
        <nav className="landing-nav" aria-label="Landing sections">
          <a href="#top">Workflow</a>
          <a href="#showcase">Showcase</a>
          <a href="#web-ai">Web AI</a>
          <a href="#webmcp">WebMCP</a>
          <a href="#features">Editor</a>
          <a href="#requirements">Requirements</a>
          <a href="#thanks">Thanks</a>
        </nav>
        <div className="header-actions">
          <GitHubStarButton />
          <a className="header-cta" href="/editor/">
            Open editor
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      <section id="top" className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Browser-native Canva-style editor</p>
          <h1 id="hero-title">Design slides with local AI, then keep editing.</h1>
          <p className="hero-subtitle">
            LocalStudio.dev turns prompt, image generation, translation, background removal, and
            local saving into one continuous slide workflow inside the browser.
          </p>
          <div className="hero-actions">
            <a className="secondary-action" href="/editor/">
              Launch editor
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
          <div className="hero-status-row" aria-label="LocalStudio capabilities">
            <span>Beta</span>
            <span>Live editor</span>
            <span>Browser API</span>
            <span>WebGPU models</span>
            <span>Local folder</span>
          </div>
        </div>

        <div id="workflow" className="workflow-carousel" aria-label="Feature workflow carousel">
          <div className="workflow-copy">
            <p className="eyebrow">Seamless workflow</p>
            <h2>{activeWorkflow.title}</h2>
            <p>{activeWorkflow.copy}</p>
          </div>
          <div className="workflow-tabs" role="tablist" aria-label="Choose workflow demo">
            {workflowSteps.map(({ id, icon: Icon, title }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeWorkflowStep === id}
                className={activeWorkflowStep === id ? 'active' : undefined}
                onClick={() => setActiveWorkflowStep(id)}
              >
                <Icon size={16} aria-hidden="true" />
                {title}
              </button>
            ))}
          </div>
          <WorkflowPreview activeStep={activeWorkflowStep} onDemoEnded={advanceWorkflowStep} />
        </div>
      </section>

      <section id="showcase" className="showcase-section" aria-labelledby="showcase-title">
        <div className="section-heading">
          <p className="eyebrow">Feature showcase</p>
          <h2 id="showcase-title">Every AI action returns to the editor.</h2>
          <p>
            The product story is not five separate demos. Each feature keeps the deck editable and
            moves the same local project forward.
          </p>
        </div>
        <div className="showcase-list">
          {featureShowcases.map((feature, index) => (
            <article className={index % 2 === 1 ? 'showcase-row reverse' : 'showcase-row'} key={feature.id}>
              <div className="showcase-copy">
                <p className="eyebrow">{feature.eyebrow}</p>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
                <ul>
                  {feature.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
              <FeatureMedia feature={feature.id} />
            </article>
          ))}
        </div>
      </section>

      <section id="demo" className="demo-section" aria-labelledby="demo-title">
        <div className="section-heading">
          <p className="eyebrow">Watch the workflow</p>
          <h2 id="demo-title">From prompt to editable slide, still local.</h2>
          <p>
            LocalStudio.dev keeps the core creation loop in the browser: prompt, edit layers,
            translate, segment, generate, and save to disk.
          </p>
        </div>
        <div className="demo-grid">
          {demoSteps.map(({ icon: Icon, title, copy, proof }) => (
            <article className="demo-card" key={title}>
              <Icon size={28} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
              <span>{proof}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="web-ai" className="web-ai-section" aria-labelledby="web-ai-title">
        <div>
          <p className="eyebrow">Why Web AI</p>
          <h2 id="web-ai-title">Model choice is a product feature.</h2>
        </div>
        <div className="web-ai-copy">
          <p>
            Chrome built-in APIs are the fast path when available. WebGPU models keep the app useful
            in other browsers and give power users explicit control over which local model backs
            each workflow.
          </p>
          <div className="ai-stack">
            <span>
              <Bot size={16} aria-hidden="true" />
              Built-in APIs
            </span>
            <span>
              <Sparkles size={16} aria-hidden="true" />
              External WebGPU models
            </span>
            <span>
              <Lock size={16} aria-hidden="true" />
              Browser-managed model cache
            </span>
          </div>
        </div>
      </section>

      <section id="webmcp" className="webmcp-section" aria-labelledby="webmcp-title">
        <div className="showcase-row">
          <div className="showcase-copy">
            <p className="eyebrow">WebMCP showcase</p>
            <h2 id="webmcp-title">A host page can drive the editor through browser tools.</h2>
            <p>
              WebMCP exposes LocalStudio actions as semantic browser tools, so an external page can
              discover capabilities, create a project, generate assets, translate the deck, and read
              the resulting project snapshot.
            </p>
            <ul>
              <li>Tool discovery from the editor iframe</li>
              <li>Prompt, image, translate, and snapshot actions</li>
              <li>Same local-first editor surface behind every call</li>
            </ul>
            <a className="inline-section-link" href="/webmcp/">
              Open WebMCP demo
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="webmcp-media">
            <img
              src="/webmcp-showcase.png"
              alt="WebMCP showcase page discovering tools and controlling the LocalStudio editor"
            />
          </div>
        </div>
      </section>

      <section id="features" className="features-section" aria-labelledby="features-title">
        <div className="feature-panel">
          <Layers3 size={34} aria-hidden="true" />
          <h2 id="features-title">An editor, not a toy demo.</h2>
          <p>
            LocalStudio already treats slides as layered documents: selectable objects, page controls,
            text editing, translation actions, imported assets, and local persistence are all part
            of the same editing surface.
          </p>
        </div>
        <ul className="proof-list">
          {editorProof.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="requirements" className="requirements-section" aria-labelledby="requirements-title">
        <div className="section-heading">
          <p className="eyebrow">Requirements</p>
          <h2 id="requirements-title">Built for modern browser AI workflows.</h2>
          <p>
            LocalStudio runs in the browser, but the models and local project files still need the
            right browser surface and enough disk space.
          </p>
        </div>
        <div className="requirements-grid">
          {requirements.map(({ icon: Icon, title, copy }) => (
            <article className="requirement-card" key={title}>
              <Icon size={30} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="thanks" className="thanks-section" aria-labelledby="thanks-title">
        <div className="section-heading">
          <p className="eyebrow">Thank you</p>
          <h2 id="thanks-title">Built on the work of the browser AI community.</h2>
          <p>
            Thanks to the Chrome Web Team for pushing built-in AI APIs forward, and to the
            Hugging Face WebML community for making local browser models easier to discover and run.
          </p>
        </div>
        <div className="thanks-links" aria-label="Browser AI resources">
          <a href={chromeBuiltInAiUrl} target="_blank" rel="noreferrer">
            Chrome Built-in AI
            <ExternalLink size={16} aria-hidden="true" />
          </a>
          <a href={huggingFaceWebMlUrl} target="_blank" rel="noreferrer">
            Hugging Face WebML community
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="closing-section" aria-labelledby="closing-title">
        <h2 id="closing-title">Try the browser-native editor.</h2>
        <a className="primary-action" href="/editor/">
          Open LocalStudio.dev
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </section>

      <footer className="landing-footer" aria-label="LocalStudio footer">
        <div>
          <a className="brand-mark footer-brand" href="#top" aria-label="LocalStudio.dev beta home">
            LocalStudio.dev
            <span className="beta-flag">Beta</span>
          </a>
          <p>Built by Erick Wendel for browser-native AI workflows.</p>
        </div>
        <nav className="footer-socials" aria-label="Erick Wendel social links">
          {socialLinks.map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer">
              {label}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </nav>
        <FooterStarCta />
      </footer>
    </main>
  );
}
