import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JoystickApp } from './app/JoystickApp';
import './styles/joystick.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JoystickApp />
  </StrictMode>,
);
