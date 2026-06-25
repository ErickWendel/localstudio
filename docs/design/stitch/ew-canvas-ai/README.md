# LocalStudio.ai Stitch Handoff

Date: 2026-06-24

This folder contains the approved Google Stitch design artifacts for the LocalStudio.ai MVP editor shell.

## Project

- Stitch project: `projects/9146003754952937997`
- Design system: `Cyber-Industrial Precision`
- Brand basis: EW Academy dark/neon identity from `https://ew.academy`

## Canonical Screens

| State | Stitch screen | Local HTML | Local screenshot |
| --- | --- | --- | --- |
| AI Tools | `projects/9146003754952937997/screens/a5e24006c84f4195a8c133be8fd2994b` | `screens/ai-tools.html` | `screens/ai-tools.jpg` |
| Design | `projects/9146003754952937997/screens/7914f5bc2b7e4843bddd72de5ecf31c4` | `screens/design.html` | `screens/design.png` |
| Layers | `projects/9146003754952937997/screens/1c78e6736bdf4d28bc506b181b0e5c63` | `screens/layers.html` | `screens/layers.png` |

## Implementation Notes

- Treat these three screens as the current visual source of truth for implementation.
- Use the header/top toolbar structure from `screens/ai-tools.html` as canonical.
- Use the export button treatment from `screens/design.html` in that canonical header.
- Preserve the shared shell across tabs: top toolbar, left page rail, central canvas, prompt bar below the canvas, floating selected-object toolbar, and right tab panel.
- The top bar is local-only. Do not include online/connectivity indicators.
- The prompt bar belongs below the main canvas and includes text input, microphone action, and submit action.
- Model management belongs in the AI Tools panel with `Download Required Models` and per-model progress/readiness.
- Use `Orbitron` for brand/tool/button labels and `Open Sans` for dense editor text.
- Use the spec at `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md` for product and architecture requirements.
