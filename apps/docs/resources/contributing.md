# Contributing

LocalStudio is a TypeScript, React, and Vite workspace.

## Start

Authenticate once against the project mirror:

```bash
vlt login --registry=https://registry.vlt.io/erickwendel/npm/
```

```bash
vlt install --expect-lockfile --allow-scripts='#core-js, #esbuild, #fsevents, #onnxruntime-node, #protobufjs, #sharp'
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
