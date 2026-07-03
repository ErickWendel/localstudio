# Web Streams

Use this reference for large, incremental, or cancellable data flows in browser JavaScript.

## When To Use Streams

- Use streams for large downloads, uploads, generated content, model output, file transforms, compression, decoding, or progress reporting.
- Do not convert to `string`, `Blob`, `ArrayBuffer`, or JSON until the full value is genuinely required.
- Prefer a stream pipeline over manual buffering when each step can operate incrementally.

## Design Rules

- Respect backpressure. Do not enqueue without considering `desiredSize` or downstream consumption.
- Use `TransformStream` for reusable decode, parse, filter, map, progress, or serialization steps.
- Use `AbortSignal` and `cancel()` paths for user cancellation, route changes, failed downstream work, and timeouts.
- Release readers and close controllers in success and error paths.
- Keep stream ownership clear: one file should own the exported stream creator or transform plus its colocated types.

## Common Patterns

- Text decoding: prefer `TextDecoderStream` when supported, or a single `TextDecoder` with streaming decode.
- Progress: count bytes in a transform instead of buffering chunks.
- Compression: use `CompressionStream` and `DecompressionStream` when the target browsers support them.
- Fanout: use `tee()` only when both branches are consumed and cancellation behavior is understood.

## Failure Modes

- Watch for accidental full buffering through `Response.text()`, `Response.blob()`, `new Blob(chunks)`, or array accumulation.
- Avoid ignoring read errors; stream failures often represent network, decode, or cancellation states.
- Avoid unbounded queues between producers and consumers.
