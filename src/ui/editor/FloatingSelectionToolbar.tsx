import {
  AlignCenter,
  BringToFront,
  Copy,
  Eraser,
  Languages,
  Lock,
  PanelTop,
  Trash2,
} from 'lucide-react';
import { IconButton } from '../components/IconButton';

export function FloatingSelectionToolbar() {
  return (
    <div className="floating-toolbar" aria-label="Selected element actions">
      <IconButton label="Center Element">
        <AlignCenter size={15} />
      </IconButton>
      <IconButton label="Bring Forward">
        <BringToFront size={15} />
      </IconButton>
      <IconButton label="Send Backward">
        <PanelTop size={15} />
      </IconButton>
      <IconButton label="Duplicate">
        <Copy size={15} />
      </IconButton>
      <IconButton label="Lock">
        <Lock size={15} />
      </IconButton>
      <IconButton label="Remove Background">
        <Eraser size={15} />
      </IconButton>
      <IconButton label="Translate This Design">
        <Languages size={15} />
      </IconButton>
      <IconButton label="Delete">
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}
