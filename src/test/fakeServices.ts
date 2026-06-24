import { createAppServices, type AppServices } from '../app/composition';

export function createFakeServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    ...createAppServices(),
    ...overrides,
  };
}
