# Hosting

LocalStudio can be hosted as a static web app.

## Required Routes

- `/`
- `/editor/`
- `/joystick/`
- `/webmcp/`
- `/docs/`

The static host must serve app entry files for extensionless deep links under those route prefixes.

## Client-Side Requirements

Hosting does not move AI or project storage to a backend. Browser AI, local folders, and model caches remain client-side workflows.

> WIP
> Add a concrete deployment example after the docs app is included in the production build.
