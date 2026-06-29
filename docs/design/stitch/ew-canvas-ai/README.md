# LocalStudio.dev Stitch Handoff

Date: 2026-06-24
Last updated: 2026-06-26

This folder contains the original Google Stitch design artifacts for the LocalStudio.dev MVP editor shell. They remain useful for colors, typography, header treatment, button style, spacing mood, and LocalStudio.dev/EW Academy visual language.

## Project

- Stitch project: `projects/9146003754952937997`
- Design system: `Cyber-Industrial Precision`
- Brand basis: EW Academy dark/neon identity from `https://ew.academy`

## Local Artifacts

| State    | Stitch screen                                                           | Local HTML              | Local screenshot       |
| -------- | ----------------------------------------------------------------------- | ----------------------- | ---------------------- |
| AI Tools | `projects/9146003754952937997/screens/a5e24006c84f4195a8c133be8fd2994b` | `screens/ai-tools.html` | `screens/ai-tools.jpg` |
| Design   | `projects/9146003754952937997/screens/7914f5bc2b7e4843bddd72de5ecf31c4` | `screens/design.html`   | `screens/design.png`   |
| Layers   | `projects/9146003754952937997/screens/1c78e6736bdf4d28bc506b181b0e5c63` | `screens/layers.html`   | `screens/layers.png`   |

## Current Implementation Guidance

- Keep the black/neon-green LocalStudio.dev styling from these screens.
- Use `Orbitron` for brand/tool/button labels and `Open Sans` for dense editor text.
- Use the header/top toolbar structure from `screens/ai-tools.html` as the visual baseline.
- Use the export button treatment from `screens/design.html`.
- The latest editor layout has evolved from the original Stitch right-tab shell:
  - tools now live in a click-toggle left rail;
  - pages/deck navigation lives in the right panel;
  - the center workspace renders pages vertically;
  - the prompt bar is docked and always visible near the bottom of the workspace;
  - footer controls own zoom/pages/fullscreen.
- AI Tools no longer has separate `Local Chrome AI` or `Cached Browser Models` sections. It shows provider/configuration cards first, then visible downloadable image model rows.
- Do not reintroduce a global `Download Required Models` button. Model preparation should be contextual per provider/model.
- Do not include online/connectivity indicators; the MVP is local-first.
- Use the current spec for product/architecture requirements: `docs/superpowers/specs/2026-06-24-canva-web-ai-clone-mvp-design.md`.
