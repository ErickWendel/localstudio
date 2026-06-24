import { createContext, useContext } from 'react';
import type { AppServices } from './composition';

export const AppServicesContext = createContext<AppServices | null>(null);

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('useAppServices must be used within AppProviders');
  return services;
}
