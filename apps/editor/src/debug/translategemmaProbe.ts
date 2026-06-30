import { TRANSLATEGEMMA_PROVIDER_ID } from '../services/browserTranslatorService';
import { BrowserModelSetupService } from '../services/modelSetupService';
import { BrowserTranslatorService } from '../services/browserTranslatorService';
import { TransformersTextGenerationRuntime } from '../services/webGpuTextGenerationRuntime';

const app = document.querySelector<HTMLDivElement>('#app');

function render() {
  if (!app) return;
  app.innerHTML = `
    <style>
      body {
        margin: 0;
        background: #050d10;
        color: #f4fff7;
        font: 16px system-ui, sans-serif;
      }

      main {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 32px;
      }

      .probe {
        width: min(760px, 100%);
        border: 1px solid rgba(55, 253, 118, 0.35);
        border-radius: 8px;
        background: rgba(12, 22, 13, 0.92);
        padding: 24px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
      }

      h1 {
        margin: 0 0 8px;
        color: #37fd76;
        font-size: 24px;
      }

      p {
        color: #cbd8ce;
      }

      button {
        border: 1px solid rgba(55, 253, 118, 0.7);
        border-radius: 5px;
        background: #37fd76;
        color: #020603;
        cursor: pointer;
        font-weight: 800;
        padding: 10px 14px;
      }

      button:disabled {
        cursor: wait;
        opacity: 0.54;
      }

      progress {
        width: 100%;
        margin: 16px 0;
        accent-color: #37fd76;
      }

      pre {
        min-height: 120px;
        overflow: auto;
        border: 1px solid rgba(55, 253, 118, 0.18);
        border-radius: 5px;
        background: #020603;
        padding: 16px;
        white-space: pre-wrap;
      }
    </style>
    <section class="probe">
      <h1>TranslateGemma Probe</h1>
      <p>Runs the same LocalStudio.dev TranslateGemma provider path used by the editor.</p>
      <button id="run-probe" type="button">Run English to Portuguese</button>
      <progress id="progress" max="100" value="0"></progress>
      <pre id="log">Idle.</pre>
    </section>
  `;
}

function appendLog(message: string) {
  const log = document.querySelector<HTMLPreElement>('#log');
  if (!log) return;
  log.textContent = `${log.textContent === 'Idle.' ? '' : `${log.textContent}\n`}${message}`;
}

async function runProbe() {
  const button = document.querySelector<HTMLButtonElement>('#run-probe');
  const progress = document.querySelector<HTMLProgressElement>('#progress');
  button?.setAttribute('disabled', 'true');
  if (progress) progress.value = 0;

  try {
    const runtime = new TransformersTextGenerationRuntime();
    const modelSetupService = new BrowserModelSetupService(undefined, undefined, undefined, runtime);
    const translatorService = new BrowserTranslatorService(modelSetupService, undefined, undefined, runtime);

    appendLog('Selecting TranslateGemma provider...');
    await translatorService.setSelectedProvider(TRANSLATEGEMMA_PROVIDER_ID);

    appendLog('Preparing en -> pt_BR...');
    await translatorService.prepareTranslation('en', 'pt', {
      onProgress: (value) => {
        if (progress) progress.value = value;
      },
    });

    appendLog('Translating sample text...');
    const translatedText = await translatorService.translate(
      'Browser-native AI keeps your design data local.',
      'pt',
      { sourceLanguage: 'en' },
    );

    if (progress) progress.value = 100;
    appendLog(`Result: ${translatedText}`);
  } catch (error) {
    appendLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    button?.removeAttribute('disabled');
  }
}

render();
document.querySelector<HTMLButtonElement>('#run-probe')?.addEventListener('click', () => {
  void runProbe();
});
