# WebMCP authoring

WebMCP lets an agent use LocalStudio's real editor commands while you watch the same canvas. The editor exposes 14 narrowly scoped tools with JSON schemas, bounded results, and visible state changes. The showcase at `/editor/webmcp/` provides an editable card for every tool.

This is an **authoring** integration. Public presentations can contain slide descriptions, transcripts, and authorized recording audio, but the public viewer does not currently register attendee WebMCP tools.

## Requirements

- Use a browser or in-app browser with WebMCP support. In Chrome builds that expose the experimental API, enable the WebMCP testing flag and relaunch.
- Run LocalStudio with `npm run dev`, then open `http://localhost:5184/editor/webmcp/` for local testing.
- Allow the embedded same-origin editor to finish loading before selecting **Discover tools**.
- For native agent discovery, open `http://localhost:5184/editor/?webmcp=1` directly. WebMCP is document-scoped, so a browser agent does not inherit tools registered by the showcase's child iframe.
- Translation, description generation, image generation, and model preparation may require browser AI support, WebGPU, model downloads, and several gigabytes of browser storage.
- Unsplash and GIPHY search require their respective keys in **Settings > Media integrations**.

## The 14 tools

All inputs are JSON objects. Unknown fields and invalid types are rejected before execution.

| Tool                                 | Input summary                                                | Result or effect                                                           |
| ------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `create_presentation`                | Optional `name`, `width`, `height`                           | Replaces the editor with a blank presentation.                             |
| `get_presentation_state`             | `detail`, optional slide and pagination fields               | Returns bounded project, slide, element, revision, and freshness state.    |
| `import_powerpoint_from_url`         | Required HTTP(S) `url`; optional safe `.pptx` `fileName`     | Starts native PPTX import and font resolution.                             |
| `translate_deck_and_notes`           | Required `targetLanguage`; optional `sourceLanguage`         | Starts translation of visible text, notes, and existing descriptions.      |
| `generate_deck_detailed_description` | Optional `slideNumbers`, `language`, `force`                 | Starts fresh, revision-linked semantic descriptions.                       |
| `list_authoring_catalog`             | `kind: "fonts"`; or animations plus `elementType`            | Returns bounded usable font or animation metadata.                         |
| `upsert_slide_content`               | Stable `requestId`, slide, mode, and typed elements          | Atomically merges or replaces exact slide primitives.                      |
| `generate_image`                     | `prompt`; optional dimensions, seed, and steps               | Starts image generation and returns an asset ID without placing it.        |
| `get_slide_preview`                  | One-based `slideNumber`                                      | Selects and fits the slide and returns dimensions, count, and render hash. |
| `get_ai_model_status`                | `{}`                                                         | Reports browser support, providers, model readiness, sizes, and errors.    |
| `prepare_ai_models`                  | Optional `modelIds`; omit to prepare required models         | Starts model downloads and preparation.                                    |
| `search_media`                       | `kind`, `term`, optional `limit`                             | Returns bounded Unsplash or GIPHY references and attribution.              |
| `export_presentation`                | `format`, optional `slideRange` and `includeAnimationFrames` | Starts a native PPTX/PDF/PNG/JPEG download.                                |
| `get_operation_status`               | `operationId`, optional `waitForChangeMs`                    | Returns queued, running, completed, or failed operation state.             |

Reader tools are marked read-only. Results containing imported or user-authored content are marked untrusted so slide text and metadata remain evidence rather than instructions.

## Long-running operations

Import, translation, description generation, image generation, model preparation, and export return an operation ID immediately:

```json
{
  "ok": true,
  "data": {
    "operationId": "operation-…",
    "status": "queued"
  }
}
```

Poll with `get_operation_status`. A wait of up to 5,000 ms reduces tight polling:

```json
{
  "operationId": "operation-…",
  "waitForChangeMs": 1000
}
```

Continue until `data.state` is `completed` or `failed`. Progress can include a stage, percentage, byte totals, slide totals, warnings, and a typed final result. The showcase automatically copies a newly returned operation ID into the status card.

## PowerPoint import is URL-only

`import_powerpoint_from_url` accepts only an authorized HTTP or HTTPS URL. It never accepts base64, raw binary, a disk path, or a staged browser file. Use a presigned MinIO/S3 URL or a localhost HTTP server.

The server must:

- allow browser CORS from the LocalStudio origin;
- return a successful HTTP status;
- return the PPTX MIME type or `application/octet-stream`;
- provide a safe `.pptx` name in the URL, `Content-Disposition`, or `fileName` input;
- stay within any deployment-specific size limit. LocalStudio does not impose a default PPTX size cap.

LocalStudio streams the download and enforces a deployment-specific limit when one is configured, then uses the same native parser, mapper, warnings, normalization, and font workflow as visible PowerPoint import. Expired URLs, unreachable servers, CORS failures, wrong MIME types, configured-limit violations, and corrupt packages fail without replacing the current project.

The normal **File > Import > PowerPoint** picker remains available for a person using the editor. It is intentionally not exposed as a WebMCP disk-import tool.

## Manual authoring workflow

1. Open `/editor/webmcp/` and select **Discover tools**. Confirm that 14 tools appear.
2. Run **Create presentation**, then **Upsert slide content**. Confirm the embedded canvas changes.
3. Run **Inspect presentation state** and compare the returned slide revision and elements with the canvas.
4. Optionally import a CORS-enabled PPTX URL. Poll the operation and review page, byte, font, and warning counts.
5. Run **Inspect AI model status**, then **Prepare AI models** with `{}` if a required model is not ready.
6. Run **Translate deck and notes** and **Generate detailed descriptions**. Poll both operations; inspect changed/skipped slides, failures, overflow warnings, description language, generator, timestamp, source revision, reviewed state, and freshness.
7. Run **Focus slide preview** before visual inspection.
8. Run each export format. Inspect the downloaded PPTX/PDF or PNG/JPEG ZIP rather than relying only on the success message.

### Cross-client check

Run this small check in every supported agent browser:

1. Open `/editor/?webmcp=1` directly and confirm native discovery returns exactly 14 tools.
2. Call `create_presentation`, `upsert_slide_content`, `get_presentation_state`, and `get_slide_preview` through the browser's WebMCP interface.
3. Confirm the state revision and preview render hash agree and visually inspect the same title on the canvas.
4. Open `/editor/webmcp/` separately and confirm its manual bridge finds the same 14 names and exposes 14 editable cards.

The direct editor route proves browser-native WebMCP. The showcase proves the judge-friendly manual control surface; they are complementary checks.

For a short judge demo, show the sequence import → translate → describe → preview → export. Keep the operation status visible in both the editor and the action card, show the canvas changing after each mutation, and finish by inspecting the exported artifact. Media search, catalogs, AI status, model preparation, and image generation can be shown briefly through their editable cards to demonstrate the complete catalog.

## Failures and recovery

- **No tools discovered:** wait for the editor frame, confirm the route is same-origin, and retry. Browsers without WebMCP use the local showcase bridge for manual testing.
- **`invalid_input`:** compare the edited JSON with the tool table; extra fields are rejected.
- **Unknown operation:** use the ID returned by the most recent long-running tool. Operation IDs are page-session state.
- **Import fails:** check URL expiry, HTTP status, CORS, MIME type, filename, size, and whether the file is a valid PPTX package.
- **Media search fails:** configure the matching Unsplash or GIPHY integration.
- **AI preparation or generation fails:** inspect `get_ai_model_status`, browser compatibility, free storage, WebGPU support, and model errors.

## Public-viewer roadmap

Attendee-side tools for slide context, transcript search, recording metadata, and navigation are a separate future surface with a different read-only authorization model. They are not part of the shipped 14-tool authoring catalog and should not be presented as current behavior.
