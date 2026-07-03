---
name: writing-typescript
description: Use when creating, editing, reviewing, or refactoring JavaScript or TypeScript code, including React components, hooks, services, utilities, styling, constants, tests, imports/exports, module organization, browser APIs, performance-sensitive code, secure code, or LocalStudio source changes.
---

# Writing TypeScript

## Overview

Apply strict SRP-oriented source organization for JavaScript and TypeScript code. Keep behavior scoped by context, keep file ownership obvious, and avoid broad shared files that create merge conflicts.

## Core Rules

- In git worktrees, refresh from the remote `main` branch before planning or editing; do not overwrite local changes to do it.
- Inspect the nearest existing context folder before adding or moving code.
- Put each implementation in the context folder that owns its behavior.
- Keep at most one public value export per source file.
- Apply the same SRP boundary to React components, hooks, utilities, services, abstractions, styles, and constants.
- Export owned types and interfaces from the same source file as their implementation.
- Do not create `index.ts` barrels or multi-value re-export files.
- Import directly from the owning source file instead of looping through aggregate modules.
- For related runtime constants, export one cohesive typed object instead of many named constants.
- Place shared constants in the nearest appropriate shared layer so product-wide changes happen in one place.
- Extract repeated logic, UI patterns, and component behavior into narrowly owned abstractions before duplication spreads.
- Keep CSS reusable and maintainable: prefer named shared style hooks/classes/tokens over long one-off rule chains or oversized lines.
- Split long files by responsibility when a file starts mixing unrelated behavior, rendering, styles, data, constants, or helpers.
- Keep source moves behavior-preserving unless the user explicitly asks for behavior changes.

## Quality Gates

- Maintainability: one value export, direct imports, colocated owned types, and context folders.
- Performance: avoid needless work, avoid accidental quadratic paths, avoid main-thread blocking, and avoid unbounded buffering.
- Platform fit: use streams, workers, abort signals, transferables, and browser primitives when they match the problem.
- Security: validate external input, avoid unsafe execution or injection, and keep secrets out of client code.
- Verification: add or run tests, benchmarks, or profiling checks that match the risk of the change, and run the repo lint step after each code/style change.

## Workflow

1. If working in a git worktree, pull or otherwise fast-forward from the remote `main` branch before planning or editing; if local changes make that unsafe, stop and report the conflict.
2. Check the current tree, package scripts, and relevant tests before editing.
3. Choose the existing context folder by responsibility; create a new context folder only when no existing one fits.
4. Add or move files so scoped roots do not mix loose implementation files with module folders.
5. Keep implementation files narrow: one exported class, function, hook, component, service, object, or constant collection.
6. Keep types colocated when they describe that file's exported value; move shared types only when they are truly owned by a shared concept.
7. Move repeated constants into the shared layer that owns their meaning, using one cohesive typed object when values belong together.
8. Factor repeated component structure, behavior, or styles into reusable pieces with narrow ownership.
9. Split long implementation or CSS files into responsibility-specific files before adding unrelated concerns.
10. Update imports to direct source paths after moves.
11. Add or update organization tests when a structural rule needs enforcement.
12. Run focused tests first, then broader verification appropriate to the change; always include the repo lint command for code or style edits.

## References

- Read `references/localstudio-contexts.md` before editing source organization in this repo.
- Read `references/performance.md` for performance-sensitive code, render paths, hot loops, async fanout, or large data handling.
- Read `references/javascript-internals.md` when runtime behavior matters: event loop, microtasks, memory retention, object shapes, deopts, or module loading.
- Read `references/web-streams.md` when handling large or incremental data, downloads, uploads, transforms, backpressure, or cancellation.
- Read `references/web-workers.md` when moving CPU-bound work off the main thread or defining worker message contracts.
- Read `references/secure-typescript.md` when code touches user input, HTML/URLs, storage, auth, permissions, secrets, serialization, or privileged browser APIs.

## LocalStudio Reference

When working in this repo, read `references/localstudio-contexts.md` before editing source organization.
