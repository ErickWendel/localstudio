# Contributing

Thanks for helping improve LocalStudio.dev.

## Local Setup

This repo uses [vlt](https://vlt.sh) as its package manager. It installs from the public npm registry, so no
login or token is needed (the project `vlt.json` overrides any private registry in your user config). Install it with
`npm install --global vlt`.

```bash
vlt install
vlt run dev
```

The default dev script starts the landing, editor, and joystick apps together. Use the landing URL as the public entry
point; `/editor/` and `/joystick/` are proxied to the connected app servers.

## Quality Checks

Run the same checks CI runs before opening a pull request:

```bash
vlt run lint
vlt run typecheck
vlt run test
vlt run build
```

## Browser Notes

LocalStudio.dev uses browser-local AI features. Some paths need Chrome experimental APIs, WebGPU, browser-managed model caches, and permission to write project files through the File System Access API.

When changing AI flows, document which browser and device you tested. When changing UI, include a screenshot or short recording in the pull request.

## Issues

Bug reports should include a reproducible video demo whenever possible. We recommend recording with
[Loom](https://chromewebstore.google.com/detail/loom-%E2%80%93-screen-recorder-sc/liecbddmkiiihnedobmlmillhodjkdmb?utm_source=localstudio.dev)
so maintainers can see the browser, steps, and failure state clearly.

## Pull Requests

Keep PRs focused. Describe the user-visible change, list the checks you ran, and call out browser-specific behavior.

Do not commit generated `dist/`, `coverage/`, `playwright-report/`, or `test-results/` output.
