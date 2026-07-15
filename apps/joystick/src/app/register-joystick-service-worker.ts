export function registerJoystickServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: import.meta.env.BASE_URL,
    });
  });
}
