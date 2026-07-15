import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from './LandingPage';
import { configureLandingScrollRestoration } from './routing/configureLandingScrollRestoration';
import { getStandaloneAppRedirectUrl } from './routing/standaloneAppRedirect';
import './landing.css';

const standaloneRedirectUrl = getStandaloneAppRedirectUrl(window.location);
if (standaloneRedirectUrl) {
  window.location.replace(standaloneRedirectUrl);
}

configureLandingScrollRestoration(window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
