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
  WandSparkles,
} from 'lucide-react';

const modelChips = [
  'Chrome Prompt API',
  'Gemma 4 WebGPU',
  'TranslateGemma',
  'Segment Anything',
  'Bonsai Image WebGPU',
];

const demoSteps = [
  {
    icon: BrainCircuit,
    title: 'Prompt to slides',
    copy: 'Turn a plain-language request into Konva-ready slide objects with structured JSON.',
    provider: 'Chrome Prompt API or Gemma 4',
  },
  {
    icon: Languages,
    title: 'Translate the deck',
    copy: 'Translate one text layer, one page, or the whole deck while preserving layout intent.',
    provider: 'Chrome Translation API or TranslateGemma',
  },
  {
    icon: Eraser,
    title: 'Remove backgrounds',
    copy: 'Click the subject, preview the segment mask, and keep refining before cutting.',
    provider: 'Segment Anything WebGPU',
  },
  {
    icon: ImagePlus,
    title: 'Create images',
    copy: 'Generate an asset from the prompt bar and drop it directly into the active slide.',
    provider: 'Bonsai Image WebGPU',
  },
  {
    icon: FolderOpen,
    title: 'Save local projects',
    copy: 'Store metadata and assets in a folder you control instead of a remote workspace.',
    provider: 'File System Access API',
  },
];

const editorProof = [
  'Layered slide canvas',
  'Pages, thumbnails, and drag reordering',
  'Text toolbar with translate actions',
  'PNG export and local folder persistence',
];

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
  return (
    <main className="landing-shell">
      <MotionBackdrop />
      <header className="landing-header">
        <a className="brand-mark" href="#top" aria-label="LocalStudio.ai home">
          LocalStudio.ai
        </a>
        <nav className="landing-nav" aria-label="Landing sections">
          <a href="#demo">Demo</a>
          <a href="#web-ai">Web AI</a>
          <a href="#features">Features</a>
          <a href="#architecture">Architecture</a>
        </nav>
        <a className="header-cta" href="/editor/">
          Open editor
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </header>

      <section id="top" className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Local-first Web AI design studio</p>
          <h1 id="hero-title">Design slides with Web AI running in your browser.</h1>
          <p className="hero-subtitle">
            A Canva alternative for developers and creators who want AI-assisted decks, image
            editing, and generation without sending every design action through a backend inference
            pipeline.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#demo">
              Watch demo
              <MonitorPlay size={18} aria-hidden="true" />
            </a>
            <a className="secondary-action" href="/editor/">
              Launch editor
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="editor-slab" aria-label="LocalStudio editor preview">
          <div className="slab-toolbar">
            <span>Prompt to slides</span>
            <span>Translate</span>
            <span>BG Remover</span>
          </div>
          <div className="slab-canvas">
            <div className="mock-image" />
            <div className="mock-title">
              <span>Web AI</span>
              <span>without the backend</span>
            </div>
            <div className="selection-frame">
              <WandSparkles size={28} aria-hidden="true" />
            </div>
          </div>
          <div className="model-strip" aria-label="Available local models">
            {modelChips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
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
          {demoSteps.map(({ icon: Icon, title, copy, provider }) => (
            <article className="demo-card" key={title}>
              <Icon size={28} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
              <span>{provider}</span>
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
            The MVP already treats slides as layered documents: selectable objects, page controls,
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
