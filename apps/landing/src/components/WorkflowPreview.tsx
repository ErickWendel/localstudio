import { FolderOpen } from 'lucide-react';
import { workflowDemoVideos } from '../content/workflowDemoVideos';

const workflowDemoPlaybackRate = 2;

export function WorkflowPreview({
  activeStep,
  onDemoEnded,
  prefersReducedMotion,
}: {
  activeStep: keyof typeof workflowDemoVideos;
  onDemoEnded: () => void;
  prefersReducedMotion: boolean;
}) {
  const demoVideo = workflowDemoVideos[activeStep];

  return (
    <div
      className="workflow-preview workflow-preview--video-only"
      data-demo={activeStep}
      aria-label="LocalStudio workflow preview"
    >
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
              autoPlay={!prefersReducedMotion}
              muted
              playsInline
              poster={demoVideo.posterSrc}
              preload="metadata"
              onLoadedMetadata={(event) => {
                event.currentTarget.defaultPlaybackRate = workflowDemoPlaybackRate;
                event.currentTarget.playbackRate = workflowDemoPlaybackRate;
              }}
              onEnded={onDemoEnded}
            >
              <source media="(min-width: 761px)" src={demoVideo.src} type="video/mp4" />
              <a href={demoVideo.fallbackSrc}>View the workflow demo</a>
            </video>
            <span className="workflow-selection-pulse" aria-hidden="true" />
            <span className="workflow-editor-cursor" aria-hidden="true" />
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
