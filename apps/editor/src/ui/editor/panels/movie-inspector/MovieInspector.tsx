import { FileVideo, FolderOpen, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useRef } from 'react';
import type {
  ElementAnimationBuild,
  ProjectDocument,
  VideoElement,
  VideoRepeatMode,
} from '../../../../domain/documents/model';
import type { MediaPlaybackPatch } from '../../../../domain/commands/elements/basicCommands';

type ElementAnimationPatch = Omit<ElementAnimationBuild, 'elementId' | 'id'>;
type MovieStartTrigger = ElementAnimationBuild['trigger'];

const videoRepeatOptions: Array<{ value: VideoRepeatMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'loop', label: 'Loop' },
  { value: 'loop-back-and-forth', label: 'Loop back and forth' },
];

interface MovieInspectorProps {
  assetName?: string | undefined;
  element: VideoElement;
  onReplaceVideoAsset?: ((file: File) => void) | undefined;
  onSetElementAnimationBuilds?: ((elementIds: string[], patch: ElementAnimationPatch) => void) | undefined;
  onUpdateMedia: (patch: MediaPlaybackPatch) => void;
  page?: ProjectDocument['pages'][number] | undefined;
}

export function MovieInspector({
  assetName,
  element,
  onReplaceVideoAsset,
  onSetElementAnimationBuilds,
  onUpdateMedia,
  page,
}: MovieInspectorProps) {
  const replaceVideoInputRef = useRef<HTMLInputElement>(null);
  const trimSliderMax = getTrimSliderMax(element);
  const trimEndSeconds = getTrimEndSeconds(element);
  const volume = element.muted ? 0 : Math.round((element.volume ?? 1) * 100);
  const repeatMode = getVideoRepeatMode(element);
  const mediaStartBuild = page?.animationBuilds?.find(
    (build) => build.elementId === element.id && build.mediaAction === 'play',
  );
  const movieStart = getMovieStartValue(mediaStartBuild, element);

  function setMovieStart(trigger: MovieStartTrigger) {
    onSetElementAnimationBuilds?.([element.id], {
      effect: 'reveal',
      trigger,
      delayMs: 0,
      durationMs: 0,
      mediaAction: 'play',
    });
    onUpdateMedia({ autoplayInPreview: true, startOnClick: trigger === 'on-click' });
  }

  return (
    <>
      <section className="movie-panel-section" aria-label="Movie file info">
        <h3>File Info</h3>
        <div className="movie-file-row">
          <FileVideo size={18} aria-hidden="true" />
          <span className="ew-ellipsis">{assetName}</span>
          <button
            className="stitch-icon-button"
            type="button"
            aria-label="Replace movie file"
            onClick={() => replaceVideoInputRef.current?.click()}
          >
            <FolderOpen size={18} aria-hidden="true" />
          </button>
          <input
            ref={replaceVideoInputRef}
            aria-label="Replace video file"
            accept="video/*"
            className="visually-hidden-input"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onReplaceVideoAsset?.(file);
              event.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="movie-panel-section" aria-label="Movie controls">
        <h3>Controls</h3>
        <div className="movie-controls-row">
          <button
            type="button"
            aria-label="Jump movie to beginning"
            onClick={() =>
              onUpdateMedia({
                playbackPositionSeconds: element.trimStartSeconds,
                playing: false,
              })
            }
          >
            <SkipBack size={18} aria-hidden="true" />
          </button>
          <button
            className="movie-play-button"
            type="button"
            aria-label={element.playing ? 'Pause movie' : 'Play movie'}
            aria-pressed={Boolean(element.playing)}
            onClick={() => onUpdateMedia({ playing: !element.playing })}
          >
            {element.playing ? (
              <Pause size={24} aria-hidden="true" />
            ) : (
              <Play size={24} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Jump movie to end"
            onClick={() =>
              onUpdateMedia({
                playbackPositionSeconds: trimEndSeconds,
                playing: false,
              })
            }
          >
            <SkipForward size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="movie-panel-section" aria-label="Movie volume">
        <h3>Volume</h3>
        <div className="movie-volume-row">
          <VolumeX size={18} aria-hidden="true" />
          <input
            aria-label="Selected video volume"
            className="ew-range-input"
            max="100"
            min="0"
            step="1"
            type="range"
            value={volume}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              onUpdateMedia({ muted: nextVolume === 0, volume: nextVolume / 100 });
            }}
          />
          <Volume2 size={20} aria-hidden="true" />
        </div>
      </section>

      <section className="movie-panel-section" aria-label="Edit movie">
        <h3>Edit Movie</h3>
        <div className="movie-trim-control">
          <span>Trim</span>
          <div className="movie-trim-track">
            <input
              aria-label="Selected video trim start"
              className="ew-range-input"
              max={trimSliderMax}
              min="0"
              step="0.1"
              type="range"
              value={element.trimStartSeconds}
              onChange={(event) => {
                const nextStart = Math.min(toTrimSeconds(event.target.value), trimEndSeconds);
                onUpdateMedia({ trimStartSeconds: nextStart });
              }}
            />
            <input
              aria-label="Selected video trim end"
              className="ew-range-input"
              max={trimSliderMax}
              min="0"
              step="0.1"
              type="range"
              value={trimEndSeconds}
              onChange={(event) => {
                const nextEnd = Math.max(toTrimSeconds(event.target.value), element.trimStartSeconds);
                onUpdateMedia({ trimEndSeconds: nextEnd });
              }}
            />
          </div>
          <div className="movie-time-row">
            <span>{formatMovieTime(element.trimStartSeconds)}</span>
            <span>{formatMovieTime(trimEndSeconds)}</span>
          </div>
        </div>

        <label className="movie-poster-control">
          <span>Poster Frame</span>
          <input
            aria-label="Selected video poster frame"
            className="ew-range-input"
            max={trimSliderMax}
            min="0"
            step="0.1"
            type="range"
            value={element.posterFrameSeconds ?? element.trimStartSeconds}
            onChange={(event) => {
              onUpdateMedia({ posterFrameSeconds: toTrimSeconds(event.target.value) });
            }}
          />
          <strong>{formatMovieTime(element.posterFrameSeconds ?? element.trimStartSeconds)}</strong>
        </label>
      </section>

      <section className="movie-panel-section" aria-label="Movie repeat">
        <label className="movie-select-control">
          <span>Repeat</span>
          <select
            aria-label="Selected video repeat mode"
            value={repeatMode}
            onChange={(event) => {
              const nextRepeatMode = event.target.value as VideoRepeatMode;
              onUpdateMedia({ loop: nextRepeatMode === 'loop', repeatMode: nextRepeatMode });
            }}
          >
            {videoRepeatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="movie-select-control">
          <span>Start</span>
          <select
            aria-label="Selected video start"
            value={movieStart}
            onChange={(event) => {
              setMovieStart(toMovieStartTrigger(event.target.value));
            }}
          >
            <option value="on-click">On click</option>
            <option value="after-transition">After transition</option>
            <option value="after-previous">After previous build</option>
          </select>
        </label>
        <label className="movie-checkbox-row">
          <input
            aria-label="Play movie across slides"
            type="checkbox"
            checked={Boolean(element.playAcrossSlides)}
            onChange={(event) => onUpdateMedia({ playAcrossSlides: event.target.checked })}
          />
          <span>Play movie across slides</span>
        </label>
      </section>
    </>
  );
}

function toTrimSeconds(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getTrimSliderMax(element: VideoElement) {
  return Math.max(
    1,
    Math.ceil(element.durationSeconds ?? 0),
    Math.ceil(element.trimStartSeconds),
    Math.ceil(element.trimEndSeconds ?? 0),
    Math.ceil(element.posterFrameSeconds ?? 0),
  );
}

function formatMovieTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const totalMilliseconds = Math.round(safeSeconds * 1000);
  const milliseconds = (totalMilliseconds % 1000).toString().padStart(3, '0');
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const displaySeconds = (totalSeconds % 60).toString().padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const displayMinutes = (totalMinutes % 60).toString().padStart(2, '0');
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  return `${hours}:${displayMinutes}:${displaySeconds},${milliseconds}`;
}

function getVideoRepeatMode(element: VideoElement): VideoRepeatMode {
  return element.repeatMode ?? (element.loop ? 'loop' : 'none');
}

function getTrimEndSeconds(element: VideoElement) {
  return element.trimEndSeconds ?? element.durationSeconds ?? getTrimSliderMax(element);
}

function getMovieStartValue(
  mediaStartBuild: ElementAnimationBuild | undefined,
  videoElement: VideoElement | undefined,
) {
  if (mediaStartBuild) return mediaStartBuild.trigger;
  return videoElement?.startOnClick ? 'on-click' : 'after-transition';
}

function toMovieStartTrigger(value: string): MovieStartTrigger {
  if (value === 'after-transition' || value === 'after-previous') return value;
  return 'on-click';
}
