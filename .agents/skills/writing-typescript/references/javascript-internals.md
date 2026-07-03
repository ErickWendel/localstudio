# JavaScript Internals

Use this reference when JavaScript runtime behavior affects correctness, responsiveness, memory, or performance.

## Event Loop

- Know whether work runs in a task, microtask, animation frame, idle callback, or worker.
- Avoid unbounded microtask chains; they can starve rendering and input.
- Use `requestAnimationFrame` for visual updates that should align with paint.
- Use chunking, yielding, workers, or streams for long-running CPU work.
- Propagate cancellation with `AbortSignal` across async boundaries.

## Promises And Concurrency

- Avoid uncontrolled `Promise.all` over large or user-sized inputs.
- Preserve error handling and cancellation when adding concurrency.
- Prefer explicit concurrency limits for network, filesystem, model, and image work.
- Avoid fire-and-forget promises unless failures are intentionally contained and logged.

## Runtime Shapes

- Keep hot objects monomorphic when possible: initialize the same fields in the same order.
- Avoid mixing unrelated value types in hot arrays or object fields.
- Avoid megamorphic call sites in hot code by keeping stable function and object shapes.
- Treat proxies, dynamic property access, and `delete` as potentially expensive in tight loops.

## Memory

- Watch closures that retain large objects, DOM nodes, buffers, images, canvas data, or model outputs.
- Clean up event listeners, timers, object URLs, observers, streams, and workers.
- Prefer transferables for large `ArrayBuffer` payloads across worker boundaries.
- Avoid retaining whole source documents when only a small normalized representation is needed.

## Modules

- Use static imports for core dependencies and dynamic imports for true feature, route, or heavy-runtime boundaries.
- Keep side effects explicit and localized.
- Avoid import cycles; direct imports should still point from consumer to owner without looping through barrels.
