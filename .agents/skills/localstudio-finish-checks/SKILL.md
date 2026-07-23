---
name: localstudio-finish-checks
description: LocalStudio project completion workflow. Use before claiming a LocalStudio/canva-webai-clone code task is done, especially after frontend, editor, Playwright, export, import, sharing, persistence, or UI workflow changes, to run the scenario E2E test, typecheck, lint, the full local test suite, and start a non-default-port dev server for user verification.
---

# LocalStudio Finish Checks

## Overview

Use this skill at the end of a LocalStudio implementation before final handoff. It enforces a concrete verification order: scenario E2E first, typecheck and lint next, the full local test suite before handoff, then a user-verification dev server on a non-default port.

Coverage must never degrade. Every new branch, state, workflow, helper, and user-visible path added by the task needs coverage that exercises the actual feature behavior, preferably through browser-level E2E coverage when the behavior is browser-visible. Do not lower thresholds, skip specs, delete assertions, or add superficial tests to make verification pass.

Leave no dead code behind. Before handoff, remove unused helpers, abandoned branches, stale TODO scaffolding, unused exports, orphaned test fixtures, and speculative abstractions that are not exercised by the implemented feature or tests.

## Workflow

1. Identify the user-facing scenario changed by the task.
   - Search `tests/e2e` for matching specs with `rg -n "<feature keyword>" tests/e2e`.
   - Prefer the narrowest existing Playwright spec that exercises the changed workflow.
   - If no spec exists and the task changed browser-visible behavior, add or update a targeted E2E spec before handoff.
   - Map each new code path to a real verification path. New browser-visible behavior needs coverage-bearing E2E; non-UI shared logic needs focused unit coverage plus the E2E path that consumes it when practical.
   - Treat coverage regressions as implementation defects. Add meaningful feature coverage or remove unneeded code until the covered surface reflects the change.

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
   - Treat unused variables, unused imports, unused exports, unreachable branches, and stale fixture code as blockers unless they are clearly unrelated pre-existing issues and reported as such.

5. Run the full local test suite.
   - This is required even when focused tests, typecheck, and lint pass, because the goal is to catch CI-breaking regressions before handoff.
   - Run:
     ```bash
     npm test
     ```
   - If `npm test` fails because of unrelated pre-existing failures, report the failing workspace/spec and the first representative error, then run the narrow task-related tests again so the task-specific result is still clear.
   - Do not describe the full local suite as passing unless the full `npm test` command passed.

6. Check that the task did not leave uncovered or dead implementation surface.
   - Review `git diff` for new functions, branches, feature flags, fixtures, and exports that are not used by the implementation or tests.
   - If the task added browser-visible behavior, run the matching coverage command when one exists for that surface, for example:
     ```bash
     npm run test:e2e:coverage:editor
     ```
     or the narrower app-specific coverage script for public-deck, joystick, landing, or webmcp changes.
   - If a coverage command is too broad to finish in the current handoff window, run the strongest practical focused checks, explain the skipped coverage command explicitly, and do not claim coverage was fully verified.
   - Do not reduce coverage thresholds or remove meaningful assertions. If coverage fails because new code is not exercised, cover the behavior or delete the unnecessary code.

7. Start a manual verification server on a non-default port.
   - This repo's `scripts/dev.mjs` reads `PORT`; `npm run dev -- --port <port>` is ignored.
   - Use `PORT=5174 npm run dev` by default. If that port is busy, use `5175`, `5176`, and so on.
   - If sandboxing blocks binding a port with `listen EPERM`, rerun the same command with approval/escalation.
   - Keep the server running for the user and include the exact URL in the final response:
     ```text
     http://localhost:<port>/editor/
     ```

## Handoff Rules

- Summarize the scenario E2E command, typecheck result, lint result, full `npm test` result, and server URL.
- Summarize the coverage-preservation check: which new behavior was covered, which coverage command ran if applicable, and whether any coverage command could not be run.
- State that dead-code review was done, including whether unused helpers, stale branches, or orphaned fixtures were removed or none were found.
- Mention known non-blocking warnings, such as JSDOM media API warnings, only if they appear in successful verification output.
- If any required verification fails for task-related reasons, fix it before final handoff.
- If a required verification cannot run, say why and do not imply the task is fully verified.
