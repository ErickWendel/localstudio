# Contributing

LocalStudio is a TypeScript, React, and Vite workspace.

## Start

This repo uses [vlt](https://vlt.sh) as its package manager. It installs from the public npm registry, so no
login or token is needed (the project `vlt.json` overrides any private registry in your user config). Install it with
`npm install --global vlt`.

```bash
vlt install
vlt run dev
```

## Checks

```bash
vlt run lint
vlt run typecheck
vlt run test
vlt run build
```

See the repository contributing files for pull request expectations.
