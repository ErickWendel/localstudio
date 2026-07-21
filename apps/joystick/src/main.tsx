import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JoystickApp } from './app/JoystickApp';
import type { JoystickSignalingService } from './app/JoystickApp';
import { JoystickCoverageDiagnosticsPage } from './app/e2e/JoystickCoverageDiagnosticsPage';
import { registerJoystickServiceWorker } from './app/register-joystick-service-worker';
import './styles/joystick.css';

type JoystickWindow = Window & {
  __LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__?: JoystickSignalingService | undefined;
};

const joystickWindow = window as JoystickWindow;

registerJoystickServiceWorker();

const app = new URL(window.location.href).searchParams.get('e2eCoverageDiagnostics') === '1' ? (
  <JoystickCoverageDiagnosticsPage />
) : (
  <JoystickApp signalingService={joystickWindow.__LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__} />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {app}
  </StrictMode>,
);
