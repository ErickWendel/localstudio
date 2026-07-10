import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ImageElement } from '../../../domain/documents/model';
import type { ImageCropHandle } from './imageCrop';

const cropHandles: Array<{ handle: ImageCropHandle; label: string }> = [
  { handle: 'top-left', label: 'Crop top left' },
  { handle: 'top', label: 'Crop top' },
  { handle: 'top-right', label: 'Crop top right' },
  { handle: 'right', label: 'Crop right' },
  { handle: 'bottom-right', label: 'Crop bottom right' },
  { handle: 'bottom', label: 'Crop bottom' },
  { handle: 'bottom-left', label: 'Crop bottom left' },
  { handle: 'left', label: 'Crop left' },
];

export function CropFrameOverlay({
  element,
  scale,
  onHandlePointerDown,
}: {
  element: ImageElement;
  scale: { x: number; y: number };
  onHandlePointerDown: (
    element: ImageElement,
    handle: ImageCropHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <div
      className="image-crop-frame"
      style={{
        height: `${element.height * scale.y}px`,
        left: `${element.x * scale.x}px`,
        top: `${element.y * scale.y}px`,
        transform: `rotate(${element.rotation}deg)`,
        width: `${element.width * scale.x}px`,
      }}
    >
      <div className="image-crop-grid" aria-hidden="true" />
      {cropHandles.map(({ handle, label }) => (
        <button
          key={handle}
          aria-label={label}
          className={`image-crop-handle image-crop-handle-${handle}`}
          type="button"
          onPointerDown={(event) => {
            onHandlePointerDown(element, handle, event);
          }}
        />
      ))}
    </div>
  );
}
