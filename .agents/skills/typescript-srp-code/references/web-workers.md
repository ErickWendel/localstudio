# Web Workers

Use this reference when JavaScript or TypeScript work can block the main thread or should be isolated by capability.

## When To Use Workers

- Move CPU-heavy parsing, image processing, model inference, compression, search, indexing, or batch transforms off the main thread.
- Keep UI orchestration, DOM access, and rendering decisions on the main thread.
- Use one worker module per capability; do not create a general catch-all worker.

## Message Contracts

- Define typed request, response, progress, error, and cancellation messages.
- Colocate worker-specific message types with the worker entrypoint or the single owner of the worker client.
- Version message contracts if persisted, shared externally, or used across independently deployed bundles.
- Treat worker messages as boundary input: validate shape before trusting it.

## Data Transfer

- Prefer transferables for large `ArrayBuffer`, `MessagePort`, `ImageBitmap`, or `OffscreenCanvas` payloads.
- Avoid structured cloning large nested objects when a compact transferable representation is possible.
- Do not transfer a buffer that the sender still needs.
- Keep serialization costs in mind when deciding whether work belongs in a worker.

## Lifecycle

- Own worker creation, cancellation, error handling, and termination in one narrow module.
- Terminate idle or abandoned workers when the feature lifetime ends.
- Propagate `AbortSignal` into worker protocols when work can be canceled.
- Handle worker startup errors and unsupported-browser fallback paths.

## Verification

- Test success, error, cancellation, and termination paths.
- Check that large payloads are transferred or streamed rather than repeatedly cloned.
- Verify UI responsiveness for the motivating workflow.
