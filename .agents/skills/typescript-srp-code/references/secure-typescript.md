# Secure TypeScript

Use this reference when code touches user input, HTML, URLs, storage, auth, permissions, secrets, serialization, network calls, files, or privileged browser APIs.

## Boundary Rules

- Validate all external input at the boundary: network, storage, URL params, postMessage, worker messages, files, clipboard, drag-and-drop, and third-party SDKs.
- Prefer allowlists over denylists for commands, MIME types, origins, protocols, and fields.
- Treat browser storage as untrusted; parse and validate before use.
- Keep validation close to the boundary and pass typed, normalized values inward.

## Browser Safety

- Avoid `eval`, `new Function`, dynamic script injection, and string-based timers.
- Avoid unsafe HTML injection. If HTML is required, sanitize with a vetted sanitizer and keep the trust boundary explicit.
- Restrict URL protocols to expected values before navigation, linking, fetches, downloads, or embeds.
- Validate `postMessage` origin and payload shape.
- Revoke object URLs and avoid leaking sensitive data through URLs, logs, crash reports, analytics, or local storage.

## Secrets And Privilege

- Never put secrets, private tokens, service credentials, or privileged keys in frontend bundles.
- Keep privileged operations behind explicit capability interfaces.
- Make permission checks server-side or platform-enforced when trust matters.
- Avoid broad ambient authority; pass the narrow capability needed for the operation.

## Data And Serialization

- Parse JSON defensively and handle schema mismatches.
- Avoid prototype pollution through untrusted object keys such as `__proto__`, `constructor`, or `prototype`.
- Be careful with recursive parsing, decompression, and large files; set size and depth limits where practical.
- Preserve escaping when generating HTML, Markdown, shell commands, SQL, file paths, or URLs.

## Verification

- Add tests for malformed input, unsafe protocols, disallowed origins, missing permissions, and storage corruption.
- Review logs and error paths for secret or user-data leakage.
- Check dependency changes for new network, filesystem, eval, or native-code behavior.
