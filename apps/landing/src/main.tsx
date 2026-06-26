import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from './LandingPage';
import './landing.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
