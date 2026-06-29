# Contributing

Thanks for helping improve LocalStudio.dev.

## Local Setup

```bash
npm ci
npm run dev
```

The default dev script opens the landing app. Use the focused scripts when you need one app:

```bash
npm run dev:landing
npm run dev:editor
```

## Quality Checks

Run the same checks CI runs before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Browser Notes

LocalStudio.dev uses browser-local AI features. Some paths need Chrome experimental APIs, WebGPU, browser-managed model caches, and permission to write project files through the File System Access API.

When changing AI flows, document which browser and device you tested. When changing UI, include a screenshot or short recording in the pull request.

## Pull Requests

Keep PRs focused. Describe the user-visible change, list the checks you ran, and call out browser-specific behavior.

Do not commit generated `dist/`, `coverage/`, `playwright-report/`, or `test-results/` output.
