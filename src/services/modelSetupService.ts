import type { ModelSetupService, ModelState } from './interfaces';

const initialStates: ModelState[] = [
  {
    id: 'background-remover',
    label: 'Background Remover',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: true,
  },
  {
    id: 'smart-crop',
    label: 'Smart Crop',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: true,
  },
  {
    id: 'magic-eraser',
    label: 'Magic Eraser',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: true,
  },
];

export class InMemoryModelSetupService implements ModelSetupService {
  private states = initialStates.map((state) => ({ ...state }));

  getModelStates(): Promise<ModelState[]> {
    return Promise.resolve(this.states.map((state) => ({ ...state })));
  }

  async downloadRequiredModels(): Promise<ModelState[]> {
    await Promise.all(
      this.states.filter((state) => state.required).map((state) => this.downloadModel(state.id)),
    );
    return this.getModelStates();
  }

  downloadModel(id: string): Promise<ModelState> {
    const current = this.states.find((state) => state.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);

    this.states = this.states.map((state) =>
      state.id === id ? { ...state, status: 'ready', progress: 100 } : state,
    );
    return Promise.resolve({ ...this.states.find((state) => state.id === id)! });
  }
}
