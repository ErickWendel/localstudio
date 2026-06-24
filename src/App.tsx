import { createAppServices } from './app/composition';
import { EditorShell } from './ui/editor/EditorShell';

const services = createAppServices();

export function App() {
  return <EditorShell services={services} />;
}
