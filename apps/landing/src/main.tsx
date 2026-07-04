import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from './LandingPage';
import { getStandaloneAppRedirectUrl } from './routing/standaloneAppRedirect';
import './landing.css';

const standaloneRedirectUrl = getStandaloneAppRedirectUrl(window.location);
if (standaloneRedirectUrl) {
  window.location.replace(standaloneRedirectUrl);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
