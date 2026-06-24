import { type PropsWithChildren, useMemo } from 'react';
import { AppServicesContext } from './appServicesContext';
import { createAppServices, type AppServices } from './composition';

export interface AppProvidersProps extends PropsWithChildren {
  services?: AppServices;
}

export function AppProviders({ children, services }: AppProvidersProps) {
  const value = useMemo(() => services ?? createAppServices(), [services]);

  return <AppServicesContext.Provider value={value}>{children}</AppServicesContext.Provider>;
}
