import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Eraser,
  FolderOpen,
  ImagePlus,
  Languages,
  Layers3,
  Lock,
  MonitorPlay,
  Sparkles,
} from 'lucide-react';

type WorkflowStepId = 'prompt' | 'image' | 'translate' | 'edit' | 'local';

const githubUrl = 'https://github.com/ErickWendel/semana-javascript-expert07';
const githubApiUrl = 'https://api.github.com/repos/ErickWendel/semana-javascript-expert07';
const workflowDemoGifs: Partial<Record<WorkflowStepId, { src: string; alt: string }>> = {
  prompt: {
    src: '/prompt-to-slide.gif',
    alt: 'Prompt-to-slide workflow generating an editable presentation in LocalStudio',
  },
  image: {
    src: '/prompt-to-image.gif',
    alt: 'Prompt-to-image workflow generating an image and continuing the slide in LocalStudio',
  },
  translate: {
    src: '/translate.gif',
    alt: 'Translate workflow updating slide text in LocalStudio',
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
];

const featureShowcases: Array<{
  id: WorkflowStepId;
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
      aria-label="Star LocalStudio.ai on GitHub"
    >
      <GitHubLogo />
      <span className="github-star-divider" aria-hidden="true" />
      <span className="github-star-count">{stars === null ? 'Star' : formatStarCount(stars)}</span>
    </a>
  );
}

function FeatureMedia({ feature }: { feature: WorkflowStepId }) {
  return (
    <div className="feature-media" data-feature={feature} aria-label={`${feature} feature preview`}>
      <div className="feature-media-toolbar">
        <span>LocalStudio.ai</span>
        <strong>{feature}</strong>
      </div>
      <div className="feature-media-canvas">
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

function WorkflowPreview({ activeStep }: { activeStep: WorkflowStepId }) {
  const demoGif = workflowDemoGifs[activeStep];

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
            {demoGif ? <img className="workflow-demo-gif" src={demoGif.src} alt={demoGif.alt} /> : null}
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

  return (
    <main className="landing-shell">
      <MotionBackdrop />
      <header className="landing-header">
        <a className="brand-mark" href="#top" aria-label="LocalStudio.ai beta home">
          LocalStudio.ai
          <span className="beta-flag">Beta</span>
        </a>
        <nav className="landing-nav" aria-label="Landing sections">
          <a href="#demo">Demo</a>
          <a href="#web-ai">Web AI</a>
          <a href="#features">Features</a>
          <a href="#architecture">Architecture</a>
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
            LocalStudio.ai turns prompt, image generation, translation, background removal, and
            local saving into one continuous slide workflow inside the browser.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#workflow">
              Choose workflow
              <MonitorPlay size={18} aria-hidden="true" />
            </a>
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
          <WorkflowPreview activeStep={activeWorkflowStep} />
        </div>
      </section>

      <section className="showcase-section" aria-labelledby="showcase-title">
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
            LocalStudio.ai keeps the core creation loop in the browser: prompt, edit layers,
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

      <section id="architecture" className="architecture-section" aria-labelledby="architecture-title">
        <p className="eyebrow">Architecture</p>
        <h2 id="architecture-title">Two projects, one repo, clean dependency boundaries.</h2>
        <div className="architecture-grid">
          <div>
            <h3>Landing</h3>
            <p>Lightweight marketing app at `/`, using shared brand tokens and no editor model deps.</p>
          </div>
          <div>
            <h3>Editor</h3>
            <p>Heavy browser editor at `/editor/`, where Konva, Transformers.js, and WebGPU runtimes live.</p>
          </div>
          <div>
            <h3>Brand package</h3>
            <p>Shared LocalStudio.ai colors, fonts, and tokens so both surfaces keep the same identity.</p>
          </div>
        </div>
      </section>

      <section className="closing-section" aria-labelledby="closing-title">
        <h2 id="closing-title">Try the browser-native editor.</h2>
        <a className="primary-action" href="/editor/">
          Open LocalStudio.ai
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}
