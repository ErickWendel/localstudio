# Performance

Use this reference for JavaScript and TypeScript changes that can affect latency, memory, throughput, bundle size, startup, rendering, or large data handling.

## Defaults

- Measure first when practical: identify the hot path, expected scale, and user-visible symptom.
- Keep optimizations behavior-preserving and covered by tests.
- Prefer simple data flow until profiling shows the code is hot.
- Avoid moving work into shared abstractions when the cost or ownership differs by context.

## Code Shape

- Avoid accidental `O(n^2)` work in reducers, nested loops, diffing, filtering, sorting, and render-derived data.
- Avoid repeated parsing, regex compilation, object cloning, JSON serialization, or expensive formatting inside hot loops.
- Prefer `Map` or `Set` for repeated keyed lookup when input size makes linear scans meaningful.
- Cache only when invalidation is obvious; stale caches are usually worse than recomputation.
- Keep frequently created objects stable in shape. Initialize fields consistently instead of adding ad hoc properties later.
- Avoid unnecessary closures, bound functions, and intermediate arrays in hot paths.

## UI And Browser

- Keep CPU-heavy work off the main thread when it can block input, animation, canvas, or rendering.
- Batch state updates and DOM reads/writes. Avoid layout thrashing.
- Memoize React values only when it reduces real work or stabilizes expensive child renders.
- Use virtualization or pagination for large lists.
- Use dynamic imports at real feature or route boundaries, not as scattered micro-splits.

## Async And Data

- Bound concurrency for network, file, model, and transform work.
- Prefer streaming for large payloads; do not buffer full data unless the full value is required.
- Use `AbortSignal` for cancellable work started by user interaction or route changes.
- Release references to large buffers, blobs, images, canvases, or model outputs when they are no longer needed.

## Verification

- For small changes, add focused tests around the optimized behavior.
- For hot code, include a benchmark, profile note, or before/after timing when feasible.
- Check memory growth when touching long-lived caches, workers, streams, object URLs, or browser storage.
