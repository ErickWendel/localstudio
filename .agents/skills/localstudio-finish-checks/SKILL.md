---
name: localstudio-finish-checks
description: LocalStudio project completion workflow. Use before claiming a LocalStudio/canva-webai-clone code task is done, especially after frontend, editor, Playwright, export, import, sharing, persistence, or UI workflow changes, to run the scenario E2E test, lint, typecheck, and start a non-default-port dev server for user verification.
---

# LocalStudio Finish Checks

## Overview

Use this skill at the end of a LocalStudio implementation before final handoff. It enforces a concrete verification order: scenario E2E first, typecheck and lint next, then a user-verification dev server on a non-default port.

## Workflow

1. Identify the user-facing scenario changed by the task.
   - Search `tests/e2e` for matching specs with `rg -n "<feature keyword>" tests/e2e`.
   - Prefer the narrowest existing Playwright spec that exercises the changed workflow.
   - If no spec exists and the task changed browser-visible behavior, add or update a targeted E2E spec before handoff.

2. Run the scenario E2E test before broad checks.
   - Use Chromium unless the task is specifically browser-dependent:
     ```bash
     npm run test:e2e -- tests/e2e/editor/<scenario>.spec.ts
     ```
   - Existing E2E specs using `withIsolatedDevServer(test)` start their own temporary server; do not start the manual verification server before this step.
   - If the scenario spans another app, use the matching path under `tests/e2e/landing`, `tests/e2e/joystick`, `tests/e2e/public-deck`, or `tests/e2e/webmcp`.

3. Run typecheck.
   ```bash
   npm run typecheck
   ```

4. Run lint.
   ```bash
   npm run lint
   ```
   - If full lint fails on unrelated pre-existing files, report that explicitly and include the first representative unrelated file/errors.
   - Then run ESLint on the files changed by the task as a scoped check:
     ```bash
     ./node_modules/.bin/eslint <changed-file-1> <changed-file-2>
     ```
   - Do not describe lint as passing unless the full `npm run lint` command passed.

5. Start a manual verification server on a non-default port.
   - This repo's `scripts/dev.mjs` reads `PORT`; `npm run dev -- --port <port>` is ignored.
   - Use `PORT=5174 npm run dev` by default. If that port is busy, use `5175`, `5176`, and so on.
   - If sandboxing blocks binding a port with `listen EPERM`, rerun the same command with approval/escalation.
   - Keep the server running for the user and include the exact URL in the final response:
     ```text
     http://localhost:<port>/editor/
     ```

## Handoff Rules

- Summarize the scenario E2E command, typecheck result, lint result, and server URL.
- Mention known non-blocking warnings, such as JSDOM media API warnings, only if they appear in successful verification output.
- If any required verification fails for task-related reasons, fix it before final handoff.
- If a required verification cannot run, say why and do not imply the task is fully verified.
