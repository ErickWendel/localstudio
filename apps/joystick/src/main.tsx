import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JoystickApp } from './app/JoystickApp';
import type { JoystickSignalingService } from './app/JoystickApp';
import './styles/joystick.css';

type JoystickWindow = Window & {
  __LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__?: JoystickSignalingService | undefined;
};

const joystickWindow = window as JoystickWindow;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JoystickApp signalingService={joystickWindow.__LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__} />
  </StrictMode>,
);
