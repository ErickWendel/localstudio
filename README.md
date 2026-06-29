# LocalStudio.dev

[![CI](https://github.com/ErickWendel/localstudio/actions/workflows/ci.yml/badge.svg)](https://github.com/ErickWendel/localstudio/actions/workflows/ci.yml)
[![Pages](https://github.com/ErickWendel/localstudio/actions/workflows/pages.yml/badge.svg)](https://github.com/ErickWendel/localstudio/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node 26](https://img.shields.io/badge/Node-26-5FA04E?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)

Browser-only Canva-style slides and image editing, powered by local Web AI.

[Live demo](https://localstudio.dev/) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

## What It Does

LocalStudio.dev runs in the browser: compose slides, generate layouts, create image assets, translate text, edit images, save project history, and export designs without a backend.

### Prompt-to-slide

A prompt becomes editable slide layers, not a flat generated image.

![Prompt to slide](apps/landing/public/prompt-to-slide.gif)

### Prompt-to-image

A prompt becomes an image asset while you keep composing the same slide.

![Prompt to image](apps/landing/public/prompt-to-image.gif)

### Translate

Translate selected text, one page, or the full deck in place.

![Translate](apps/landing/public/translate.gif)

### Edit images

Remove the background, then flip or expand the image as a normal layer.

![Edit images](apps/landing/public/edit-images.gif)

### Work locally

Save project files to disk and restore from local version history.

![Local project history](apps/landing/public/fs-history.gif)

### Powered by Web AI

Browser-native AI capabilities keep the workflow fast, private, and local-first.

![Web AI setup](apps/landing/public/powered-webau.gif)

## Quick Start

```bash
npm ci
npm run dev
```

Focused local apps:

```bash
npm run dev:landing
npm run dev:editor
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Browser AI Stack

Some features need Chrome experimental APIs, WebGPU, browser-managed model caches, and local folder permissions.

- Chrome APIs: [Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [Translator API](https://developer.chrome.com/docs/ai/translator-api), [Language Detector API](https://developer.chrome.com/docs/ai/language-detection)
- Hugging Face models: [Gemma 4 E2B](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX), [TranslateGemma 4B](https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX), [XLM-RoBERTa language detection](https://huggingface.co/onnx-community/xlm-roberta-base-language-detection-ONNX), [SlimSAM](https://huggingface.co/Xenova/slimsam-77-uniform), [Bonsai Image 4B](https://huggingface.co/prism-ml/bonsai-image-ternary-4B-mlx-2bit)
- WebML references: [Bonsai Image WebGPU Space](https://huggingface.co/spaces/webml-community/bonsai-image-webgpu), [Hugging Face WebML community](https://huggingface.co/webml-community)

## Workspace

- `apps/landing`: product page at `/`
- `apps/editor`: Web AI editor at `/editor/`
- `packages/brand`: shared LocalStudio.dev tokens and CSS

## Roadmap

- More browser/device verification for WebGPU flows.
- Better model selection and generation history.
- Deeper export formats beyond PNG.
- More examples built with the editor.

## License

MIT. See [LICENSE](LICENSE).
