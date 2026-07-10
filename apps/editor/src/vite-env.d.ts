/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_DISABLE_EDITOR_TOUR?: string;
}
