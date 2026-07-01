---
name: typescript-srp-code
description: Create, edit, review, or refactor any JavaScript or TypeScript code. Use for TS/JS implementation, bug fixes, tests, React components, hooks, services, domain logic, utilities, config helpers, module organization, imports/exports, performance work, JavaScript runtime internals, Web Streams, Web Workers, secure code, and LocalStudio source changes. Applies strict SRP by default: one public value export per file, colocated types, direct imports, and no barrel files.
---

# TypeScript SRP Code

## Overview

Apply strict SRP-oriented source organization for JavaScript and TypeScript code. Keep behavior scoped by context, keep file ownership obvious, and avoid broad shared files that create merge conflicts.

## Core Rules

- Inspect the nearest existing context folder before adding or moving code.
- Put each implementation in the context folder that owns its behavior.
- Keep at most one public value export per source file.
- Export owned types and interfaces from the same source file as their implementation.
- Do not create `index.ts` barrels or multi-value re-export files.
- Import directly from the owning source file instead of looping through aggregate modules.
- For related runtime constants, export one cohesive typed object instead of many named constants.
- Keep source moves behavior-preserving unless the user explicitly asks for behavior changes.

## Quality Gates

- Maintainability: one value export, direct imports, colocated owned types, and context folders.
- Performance: avoid needless work, avoid accidental quadratic paths, avoid main-thread blocking, and avoid unbounded buffering.
- Platform fit: use streams, workers, abort signals, transferables, and browser primitives when they match the problem.
- Security: validate external input, avoid unsafe execution or injection, and keep secrets out of client code.
- Verification: add or run tests, benchmarks, or profiling checks that match the risk of the change.

## Workflow

1. Check the current tree, package scripts, and relevant tests before editing.
2. Choose the existing context folder by responsibility; create a new context folder only when no existing one fits.
3. Add or move files so scoped roots do not mix loose implementation files with module folders.
4. Keep implementation files narrow: one exported class, function, hook, component, service, object, or constant collection.
5. Keep types colocated when they describe that file's exported value; move shared types only when they are truly owned by a shared concept.
6. Update imports to direct source paths after moves.
7. Add or update organization tests when a structural rule needs enforcement.
8. Run focused tests first, then broader verification appropriate to the change.

## References

- Read `references/localstudio-contexts.md` before editing source organization in this repo.
- Read `references/performance.md` for performance-sensitive code, render paths, hot loops, async fanout, or large data handling.
- Read `references/javascript-internals.md` when runtime behavior matters: event loop, microtasks, memory retention, object shapes, deopts, or module loading.
- Read `references/web-streams.md` when handling large or incremental data, downloads, uploads, transforms, backpressure, or cancellation.
- Read `references/web-workers.md` when moving CPU-bound work off the main thread or defining worker message contracts.
- Read `references/secure-typescript.md` when code touches user input, HTML/URLs, storage, auth, permissions, secrets, serialization, or privileged browser APIs.

## LocalStudio Reference

When working in this repo, read `references/localstudio-contexts.md` before editing source organization.
