import { Eye, GripVertical, Image, Lock, Search, Square, Type } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { PanelSection } from '../components/PanelSection';

const layers = [
  { id: 'text-title', name: 'Title', icon: Type },
  { id: 'text-subtitle', name: 'Subtitle', icon: Type },
  { id: 'image-hero', name: 'Selected Image', icon: Image, selected: true },
  { id: 'shape-bg', name: 'Background Shape', icon: Square },
  { id: 'page-background', name: 'Page Background', icon: Square },
];

export function LayersPanel() {
  return (
    <div className="panel-stack">
      <div className="layer-search">
        <Search size={15} />
        <input aria-label="Search layers" placeholder="Search layers" type="search" />
      </div>
      <PanelSection title="Stack">
        <p className="panel-muted">5 layers on current page</p>
        <div className="layer-list">
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <article
                key={layer.id}
                className={layer.selected ? 'layer-row layer-row-selected' : 'layer-row'}
              >
                <GripVertical size={15} />
                <Icon size={16} />
                <span>{layer.name}</span>
                <IconButton label={`Toggle ${layer.name} visibility`}>
                  <Eye size={13} />
                </IconButton>
                <IconButton label={`Lock ${layer.name}`}>
                  <Lock size={13} />
                </IconButton>
              </article>
            );
          })}
        </div>
      </PanelSection>
      <PanelSection title="Selected Layer">
        <div className="property-row">
          <span>Type</span>
          <strong>Image</strong>
        </div>
        <div className="property-row">
          <span>Z-order</span>
          <strong>3 / 5</strong>
        </div>
      </PanelSection>
    </div>
  );
}
