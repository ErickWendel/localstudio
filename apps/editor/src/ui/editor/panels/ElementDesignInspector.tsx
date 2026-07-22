import { Film, Image, Square, Type, Video } from 'lucide-react';
import { useState } from 'react';
import type {
  DesignElement,
  ElementAnimationBuild,
  ProjectDocument,
} from '../../../domain/documents/model';
import type {
  AlignMode,
  ElementFramePatch,
  ElementStylePatch,
  MediaPlaybackPatch,
  ZOrderMode,
} from '../../../domain/commands/elements/basicCommands';
import { PanelSection } from '../../components/PanelSection';
import { MovieInspector } from './movie-inspector/MovieInspector';
import { ShapeStyleInspector } from './shape-style/ShapeStyleInspector';
import { TextStyleInspector } from './text-style/TextStyleInspector';
import type { TextStyleControls } from './text-style/TextStyleInspector';

type ElementAnimationPatch = Omit<ElementAnimationBuild, 'elementId' | 'id'>;
type ElementInspectorTab = 'arrange' | 'content' | 'style';

function getBoundedNumber(value: string, fallback: number, minimum = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function getElementContentTabLabel(element: DesignElement) {
  if (element.type === 'text') return 'Text';
  if (element.type === 'gif' || element.type === 'video') return 'Movie';
  if (element.type === 'shape') return 'Shape';
  return 'Image';
}

function getElementIcon(element: DesignElement) {
  if (element.type === 'text') return <Type size={16} />;
  if (element.type === 'image') return <Image size={16} />;
  if (element.type === 'gif') return <Film size={16} />;
  if (element.type === 'video') return <Video size={16} />;
  return <Square size={16} />;
}

export function ElementDesignInspector({
  assetName,
  element,
  onAlign,
  onFrameUpdate,
  onLockChange,
  onReplaceVideoAsset,
  onSetElementAnimationBuilds,
  onTextContentChange,
  onUpdateMedia,
  onUpdateStyle,
  page,
  onZOrderChange,
  textStyleControls,
}: {
  assetName?: string | undefined;
  element: DesignElement;
  onAlign?: ((mode: AlignMode) => void) | undefined;
  onFrameUpdate?: ((patch: ElementFramePatch) => void) | undefined;
  onLockChange?: ((locked: boolean) => void) | undefined;
  onReplaceVideoAsset?: ((file: File) => void) | undefined;
  onSetElementAnimationBuilds?: (elementIds: string[], patch: ElementAnimationPatch) => void;
  onTextContentChange?: ((text: string) => void) | undefined;
  onUpdateMedia: (patch: MediaPlaybackPatch) => void;
  onUpdateStyle: (patch: ElementStylePatch) => void;
  page?: ProjectDocument['pages'][number] | undefined;
  onZOrderChange?: ((mode: ZOrderMode) => void) | undefined;
  textStyleControls?: TextStyleControls | undefined;
}) {
  const defaultTab = element.type === 'text' || element.type === 'shape' ? 'style' : 'content';
  const [activeTab, setActiveTab] = useState<ElementInspectorTab>(defaultTab);
  const contentLabel = getElementContentTabLabel(element);
  const locked = element.locked;
  const videoElement = element.type === 'video' ? element : undefined;

  return (
    <PanelSection title={contentLabel}>
      <div className="movie-inspector-tabs" role="tablist" aria-label="Movie inspector sections">
        <button
          aria-selected={activeTab === 'style'}
          className={
            activeTab === 'style'
              ? 'movie-inspector-tab movie-inspector-tab-active'
              : 'movie-inspector-tab'
          }
          role="tab"
          type="button"
          onClick={() => setActiveTab('style')}
        >
          Style
        </button>
        <button
          aria-selected={activeTab === 'content'}
          className={
            activeTab === 'content'
              ? 'movie-inspector-tab movie-inspector-tab-active'
              : 'movie-inspector-tab'
          }
          role="tab"
          type="button"
          onClick={() => setActiveTab('content')}
        >
          {contentLabel}
        </button>
        <button
          aria-selected={activeTab === 'arrange'}
          className={
            activeTab === 'arrange'
              ? 'movie-inspector-tab movie-inspector-tab-active'
              : 'movie-inspector-tab'
          }
          role="tab"
          type="button"
          onClick={() => setActiveTab('arrange')}
        >
          Arrange
        </button>
      </div>

      {activeTab === 'style' ? (
        <>
          {element.type === 'text' && textStyleControls ? (
            <TextStyleInspector
              element={element}
              onUpdateStyle={onUpdateStyle}
              {...textStyleControls}
            />
          ) : null}
          {element.type === 'shape' ? (
            <ShapeStyleInspector element={element} onUpdateStyle={onUpdateStyle} />
          ) : null}
          <section className="movie-panel-section" aria-label="Selected element style">
            <h3>Selection</h3>
            <div className="compact-action design-selection-summary ew-surface ew-surface-hover ew-compact-row">
              {getElementIcon(element)}
              <span>Selected {element.type}</span>
            </div>
            <label className="design-control ew-field-scope">
              <span>Opacity</span>
              <input
                aria-label="Selected element opacity"
                max="100"
                min="0"
                type="range"
                value={Math.round(element.opacity * 100)}
                onChange={(event) => {
                  onUpdateStyle({ opacity: Number(event.target.value) / 100 });
                }}
              />
            </label>
          </section>
        </>
      ) : null}

      {activeTab === 'content' ? (
        <>
          {videoElement ? (
            <MovieInspector
              assetName={assetName}
              element={videoElement}
              onReplaceVideoAsset={onReplaceVideoAsset}
              onSetElementAnimationBuilds={onSetElementAnimationBuilds}
              onUpdateMedia={onUpdateMedia}
              page={page}
            />
          ) : null}
          {element.type === 'text' ? (
            <section className="movie-panel-section" aria-label="Selected text content controls">
              <h3>Content</h3>
              <label className="design-control design-control-stacked ew-field-scope">
                <span>Text</span>
                <textarea
                  aria-label="Selected text content"
                  value={element.text}
                  onChange={(event) => {
                    onTextContentChange?.(event.target.value);
                  }}
                />
              </label>
            </section>
          ) : null}
          {element.type === 'gif' ? (
            <section className="movie-panel-section" aria-label="GIF movie controls">
              <h3>Movie</h3>
              <div className="movie-file-row">
                <Film size={18} aria-hidden="true" />
                <span className="ew-ellipsis">{assetName ?? 'Animated GIF'}</span>
              </div>
              <label className="movie-checkbox-row">
                <input
                  aria-label="Play selected GIF"
                  type="checkbox"
                  checked={element.playing}
                  onChange={(event) => onUpdateMedia({ playing: event.target.checked })}
                />
                <span>Play GIF</span>
              </label>
            </section>
          ) : null}
          {element.type === 'image' ? (
            <section className="movie-panel-section" aria-label="Selected image controls">
              <h3>Image</h3>
              <div className="movie-file-row">
                <Image size={18} aria-hidden="true" />
                <span className="ew-ellipsis">{assetName ?? 'Imported image'}</span>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === 'arrange' ? (
        <>
          <section className="movie-panel-section" aria-label="Arrange selected element order">
            <div className="movie-arrange-grid ew-two-column-grid">
              <button type="button" onClick={() => onZOrderChange?.('back')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  flip_to_back
                </span>
                Back
              </button>
              <button type="button" onClick={() => onZOrderChange?.('front')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  flip_to_front
                </span>
                Front
              </button>
              <button type="button" onClick={() => onZOrderChange?.('backward')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  keyboard_arrow_down
                </span>
                Backward
              </button>
              <button type="button" onClick={() => onZOrderChange?.('forward')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  keyboard_arrow_up
                </span>
                Forward
              </button>
            </div>
            <div className="movie-arrange-select-row ew-field-scope ew-two-column-grid">
              <select
                aria-label="Align selected element"
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  onAlign?.(event.target.value as AlignMode);
                  event.target.value = '';
                }}
              >
                <option value="" disabled>
                  Align
                </option>
                <option value="page-left-center">Center left</option>
                <option value="horizontal-center">Horizontal center</option>
                <option value="page-right-center">Center right</option>
                <option value="page-top-center">Center top</option>
                <option value="vertical-center">Vertical center</option>
                <option value="page-bottom-center">Center bottom</option>
                <option value="page-center">Page center</option>
              </select>
              <button type="button" disabled>
                Distribute
              </button>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Selected element size">
            <h3>Size</h3>
            <div className="movie-number-grid ew-field-scope ew-two-column-grid">
              <label>
                <input
                  aria-label="Selected element width"
                  min="1"
                  type="number"
                  value={Math.round(element.width)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      width: getBoundedNumber(event.target.value, element.width, 1),
                    })
                  }
                />
                <span>Width</span>
              </label>
              <label>
                <input
                  aria-label="Selected element height"
                  min="1"
                  type="number"
                  value={Math.round(element.height)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      height: getBoundedNumber(event.target.value, element.height, 1),
                    })
                  }
                />
                <span>Height</span>
              </label>
            </div>
            <label className="movie-checkbox-row">
              <input type="checkbox" checked readOnly />
              <span>Constrain proportions</span>
            </label>
            <button className="movie-full-button" type="button" disabled>
              Original Size
            </button>
          </section>

          <section className="movie-panel-section" aria-label="Selected element position">
            <h3>Position</h3>
            <div className="movie-number-grid ew-field-scope ew-two-column-grid">
              <label>
                <input
                  aria-label="Selected element x position"
                  type="number"
                  value={Math.round(element.x)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      x: getBoundedNumber(event.target.value, element.x),
                    })
                  }
                />
                <span>X</span>
              </label>
              <label>
                <input
                  aria-label="Selected element y position"
                  type="number"
                  value={Math.round(element.y)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      y: getBoundedNumber(event.target.value, element.y),
                    })
                  }
                />
                <span>Y</span>
              </label>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Selected element rotation">
            <h3>Rotate</h3>
            <div className="movie-number-grid ew-field-scope ew-two-column-grid">
              <label>
                <input
                  aria-label="Selected element rotation"
                  type="number"
                  value={Math.round(element.rotation)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      rotation: getBoundedNumber(event.target.value, element.rotation, -360),
                    })
                  }
                />
                <span>Angle</span>
              </label>
              <button className="movie-full-button" type="button" disabled>
                Flip
              </button>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Selected element lock and grouping">
            <div className="movie-lock-grid ew-two-column-grid">
              <button type="button" disabled={locked} onClick={() => onLockChange?.(true)}>
                Lock
              </button>
              <button type="button" disabled={!locked} onClick={() => onLockChange?.(false)}>
                Unlock
              </button>
              <button type="button" disabled>
                Group
              </button>
              <button type="button" disabled>
                Ungroup
              </button>
            </div>
          </section>
        </>
      ) : null}
    </PanelSection>
  );
}
