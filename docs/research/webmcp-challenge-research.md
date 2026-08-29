# WebMCP Challenge research and LocalStudio opportunity map

Research date: 2026-08-26. Sources are limited to the challenge owner, WebMCP specification/community repository, Chrome, OpenAI, and first-party sponsor examples. The WebMCP draft and challenge rules are changing documents; re-check them before submission.

## Executive read

LocalStudio has an unusually strong WebMCP story because a presentation spans two agent-native moments:

1. **Authoring:** a person gives an agent a `.pptx` and asks for an outcome—import it, localize it, and publish it—while both watch the same editable canvas.
2. **Attending:** a recipient opens the public deck and asks their own agent to understand it through structured slide text, semantic slide descriptions, timestamped speech, and recording metadata, then navigate to the evidence in the visible presentation.

The best framing is not “AI makes slides.” It is **“a presentation becomes a collaborative web surface for both its creator and its audience.”** WebMCP is essential because it exposes the live application state and the app's real actions, rather than making the agent infer controls from pixels. This directly matches the challenge's request for things people and agents can do together that were difficult before and its four equally weighted criteria: WebMCP leverage, execution, potential impact, and creativity/ambition ([challenge overview](https://webmcp.devpost.com/), [official rules](https://webmcp.devpost.com/rules)).

### Critical eligibility issue

The official rules explicitly exclude individuals resident in Brazil and organizations domiciled there. This must be resolved with the hackathon manager before treating LocalStudio as an eligible prize submission. Do not attempt to route around the rule with a nominal entrant: team representatives and every eligible individual must meet the requirements, and apparent conflicts can be disqualifying ([official rules, eligibility](https://webmcp.devpost.com/rules)). Product work can still proceed as an open WebMCP showcase even if an entry is not eligible.

## Challenge facts

### Timeline

| Milestone                        | Pacific time                        | São Paulo time (UTC-3)         |
| -------------------------------- | ----------------------------------- | ------------------------------ |
| Registration/submission opens    | Aug 25, 2026, 11:00 AM PDT          | Aug 25, 3:00 PM                |
| Registration/submission deadline | Sep 3, 2026, 1:00 PM PDT            | Sep 3, 5:00 PM                 |
| Judging                          | Sep 4, 10:00 AM–Sep 21, 5:00 PM PDT | Sep 4, 2:00 PM–Sep 21, 9:00 PM |
| Winners announced                | Around Sep 23, 2:00 PM PDT          | Around Sep 23, 6:00 PM         |

Source: [official rules](https://webmcp.devpost.com/rules). The displayed São Paulo times are conversions, not times stated by Devpost.

### Eligibility and project provenance

- Entrants may be adults, teams of eligible adults, or eligible organizations in OpenAI API-supported countries, subject to the exclusions in the rules.
- Brazil is explicitly excluded.
- An existing product is allowed only if it is **meaningfully extended with WebMCP after the submission period began**. Judges evaluate only that new work. The submission must clearly distinguish old from new with timestamped commits or equivalent evidence.
- Third-party SDKs, APIs, data, trademarks, and media must be authorized.

Source: [official rules, sections 3–4](https://webmcp.devpost.com/rules).

For LocalStudio, create a dated “before WebMCP challenge” baseline, a short change log of challenge-only capabilities, and a clean commit range. Existing editor, PPTX, translation, recording, and sharing functionality should be described as the platform; the new tool surfaces, slide semantic context, attendee tools, and end-to-end agent workflows are the evaluated extension.

### Required submission package

- A working live URL usable in ChatGPT's in-app browser or Chrome with WebMCP enabled. Authentication is allowed if credentials are included for judges.
- A text description covering why WebMCP fits, the UX improvement, what people and agents can now do together, and a brief implementation explanation.
- A public YouTube demo under three minutes, with audio, clearly showing the project working and how WebMCP is used. Judges need not watch after three minutes.
- A public GitHub, GitLab, or Bitbucket repository with all necessary source, assets, setup instructions, and an open-source license that is detectable at the top of the repository page.
- The project must remain freely accessible for judging through the end of the judging period. Submission materials must be English or include English translations.

Sources: [challenge overview](https://webmcp.devpost.com/), [official rules, submission and testing requirements](https://webmcp.devpost.com/rules).

The Devpost page oddly renders a `registerTool()` sample under the repository requirements; regardless of whether that layout is accidental, a reviewer should be able to find the actual WebMCP registration code quickly.

### Judging model

Stage one is pass/fail for theme fit and real use of the required APIs. Stage two scores four criteria equally:

1. **WebMCP leverage:** thorough, skillful, non-trivial working implementation.
2. **Execution:** a complete, coherent product experience rather than a technical proof of concept.
3. **Potential impact:** a credible, specific problem and audience, solved in the demo.
4. **Creativity and ambition:** novelty relative to existing concepts.

Source: [official rules, judges and criteria](https://webmcp.devpost.com/rules).

This favors one polished end-to-end job over a large catalog of shallow tools. A judge may use only the video and description, so the three-minute narrative has to prove all four criteria without relying on exploratory testing.

### Prizes

There are ten winning submissions. Per the official rules, each receives $3,000 cash from OpenAI plus $500 cash from Netlify, an OpenAI developer spotlight, one Codex Micro, OpenAI swag and one year of Pro for up to three team members, $10,000 Cloudflare credits, twelve months of Vercel credits ($300/month plus $50/month in Gateway credits), $300 Render credits, $250 Shopify gear, and a three-month Google AI Ultra subscription per team member. The rules govern substitutions, verification, taxes, and delivery ([official rules, prizes](https://webmcp.devpost.com/rules)).

## WebMCP technical model

### Maturity and mental model

WebMCP is a Web Machine Learning Community Group **draft report**, not a W3C Standard or Standards Track document. It lets a web page expose JavaScript-backed actions as named tools with descriptions and structured schemas. The key collaboration property is that the human, agent, live UI state, and signed-in browser session stay together ([WebMCP draft](https://webmachinelearning.github.io/webmcp/), [OpenAI site tools guide](https://learn.chatgpt.com/docs/webmcp)).

It differs from conventional MCP: an MCP server can operate independently of an open page, while WebMCP tools are discovered only after the browser visits the page and are bound to that page's lifecycle and state. OpenAI specifically calls out editors and dashboards—cases where human and agent need to see the same thing—as a strong fit ([OpenAI site tools guide](https://learn.chatgpt.com/docs/webmcp)).

### Imperative API

The current draft hangs the API from `document.modelContext`:

- `registerTool(tool, options)` registers one tool.
- `getTools(options)` lets an in-page agent discover authorized tools from the document/frame tree.
- `executeTool(tool, inputArguments, options)` invokes a discovered tool. The native browser
  boundary takes `inputArguments` as serialized JSON and returns a serialized JSON result, so the
  showcase stringifies inputs and parses results before applying workflow behavior.
- `toolchange` reports discovery changes.
- `AbortSignal` manages registration lifetime and cancellation; tool execution receives its own signal.

A tool has `name`, optional human-facing `title`, `description`, optional JSON `inputSchema`, `execute`, and annotations. Current annotations are `readOnlyHint` and `untrustedContentHint` ([WebMCP API draft](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api)). Tool names are currently limited by the draft to 1–128 characters using ASCII letters/numbers plus `_`, `-`, and `.`.

Registration should feature-detect the API so the human interface continues to work in browsers without WebMCP. Chrome recommends registering tools only in states where they are useful, avoiding overlapping tools, using narrow typed schemas, validating strictly in application code, updating visible UI state, and returning meaningful errors that let an agent recover ([Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices), [OpenAI site tools guide](https://learn.chatgpt.com/docs/webmcp)).

### Declarative API

Chrome's experimental declarative API converts semantic HTML forms into tools via `toolname`, `tooldescription`, and optional `toolparamdescription`. The browser derives a JSON Schema from the fields and keeps the form visible while filling it. Submission can remain human-confirmed or use `toolautosubmit`; `SubmitEvent.agentInvoked` identifies an agent action and `respondWith()` returns a structured result. Active pseudo-classes provide visible focus feedback ([Chrome declarative API guide](https://developer.chrome.com/docs/ai/webmcp/declarative-api)).

However, the Community Group specification's declarative section is still explicitly TODO and points to the explainer. LocalStudio's core workflows should therefore use the imperative API; declarative WebMCP is suitable only for ordinary forms where visible human confirmation adds value ([WebMCP draft, declarative section](https://webmachinelearning.github.io/webmcp/)).

### Browser support and testing

- The challenge says the current ChatGPT desktop in-app browser supports WebMCP by default.
- OpenAI says ChatGPT Work and Codex can use site tools in its built-in browser with GPT-5.6 Sol or Terra; Luna currently has WebMCP disabled, Enterprise/Edu do not have site tools, and availability can depend on rollout.
- Chrome documents an origin trial beginning in Chrome 149. For local/challenge testing, enable `chrome://flags/#enable-webmcp-testing` and relaunch.
- Chrome's Model Context Tool Inspector can list, manually invoke, schema-check, and inspect the outputs/errors of registered tools.
- WebMCP is primarily a local, human-in-the-loop browser workflow. Clients must visit a site to discover its tools.

Sources: [challenge instructions](https://webmcp.devpost.com/), [OpenAI site tools guide](https://learn.chatgpt.com/docs/webmcp), [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp).

### Origins, frames, and security

The API requires origin isolation and is gated by the `tools` Permissions Policy. The default is `self`: top-level and same-origin documents can participate, cross-origin iframes cannot. Cross-origin use requires both iframe delegation (`allow="tools"`) and explicit secure-origin exposure/request via `exposedTo` and `fromOrigins` ([Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp), [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api)).

The draft threat model calls out malicious instructions in tool metadata and outputs, misleading tool descriptions, privacy leakage from over-parameterized schemas, and same-origin/private-browsing boundary risks. OpenAI treats website tool definitions and results as untrusted and safety-reviews every tool call, but explicitly says those checks do not make the site trustworthy ([WebMCP security and privacy considerations](https://webmachinelearning.github.io/webmcp/), [OpenAI security and user controls](https://learn.chatgpt.com/docs/webmcp)).

Implementation implications for LocalStudio:

- Mark transcript, slide text, slide descriptions, comments, and other imported/user-authored material with `untrustedContentHint: true`; they can contain prompt injection even when the deck owner is trusted.
- Mark retrieval tools `readOnlyHint: true`. Keep import, translate, publish, and playback-state tools clearly identified as state-changing.
- Reuse existing authentication, authorization, validation, and share permissions. A WebMCP registration is not an authorization boundary.
- Keep argument schemas minimal; never ask the agent for unrelated profile data.
- Return evidence needed to verify the result: project/page IDs, counts, warnings, target language, publish status, final URL, slide number, and timestamp.
- Chrome recommends concise budgets: about 30 characters for names, 150 per parameter description, 500 per tool description, and 1.5K per individual output. Therefore do not return full decks, transcripts, or audio bytes in one tool call; paginate/retrieve bounded segments and return URLs plus metadata for media ([Chrome tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)).

## First-party reference experiences and the whitespace

Chrome links three official demos: WebMCP zaMaker (imperative manipulation of pizza layers), a React travel demo (imperative), and Le Petit Bistro (declarative form flow). Its imperative docs also link a page-agent iframe example ([Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp), [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api)). The Devpost resources add sponsor examples: Cloudflare's coffee store and Workers template, and Vercel's WebMCP-enabled storefront and source diff ([challenge resources](https://webmcp.devpost.com/resources)).

OpenAI's site-tools documentation demonstrates documentation lookup/navigation and the Margin local note editor; the public Showcase currently says “WebMCP examples are coming soon” ([OpenAI site tools guide](https://learn.chatgpt.com/docs/webmcp), [OpenAI Showcase](https://developers.openai.com/showcase)).

The visible reference set is concentrated in forms, commerce, navigation, and direct editing. A presentation system that exposes an **artifact lifecycle plus audience-side multimodal evidence** is differentiated. It also naturally demonstrates both state-changing and read-only tools, dynamic tool registration across editor/public-viewer routes, and shared visible state.

## LocalStudio baseline before the challenge implementation

This is a repository inspection, not a live production audit.

- At the time of the initial audit, the WebMCP adapter exposed five editor tools: `create_project`, `generate_slides`, `generate_image`, `translate_text`, and `get_project_snapshot` in [`apps/editor/src/services/webmcp/webMcpToolAdapter.ts`](../../apps/editor/src/services/webmcp/webMcpToolAdapter.ts).
- The showcase discovers them from an embedded editor and provides a local fallback bridge in [`apps/editor/src/ui/webmcp/WebMcpShowcasePage.tsx`](../../apps/editor/src/ui/webmcp/WebMcpShowcasePage.tsx).
- The public viewer already contains published recording audio, timestamped transcript navigation, and transcript-grounded Q&A UI in [`apps/editor/src/ui/share/PublicDeckViewer.tsx`](../../apps/editor/src/ui/share/PublicDeckViewer.tsx).
- Product docs describe editable PPTX import, deck translation, and public sharing, though translation and sharing docs still mark parts of the capture/verification story as work in progress: [`powerpoint.md`](../../apps/docs/guide/local-projects/import/powerpoint.md), [`translate-decks.md`](../../apps/docs/guide/work-with-web-ai/translate-decks.md), and [`sharing.md`](../../apps/docs/guide/local-projects/sharing.md).

The challenge delta should therefore be framed as connecting existing deep product capabilities through dependable WebMCP authoring contracts and adding semantic slide descriptions—not as claiming the underlying editor, importer, recorder, or public viewer were all built during the challenge. Attendee-side WebMCP remains a separate future opportunity.

## Shipped authoring implementation

The source now exposes 14 production authoring tools through the editor route:

1. `create_presentation`
2. `get_presentation_state`
3. `import_powerpoint_from_url`
4. `translate_deck_and_notes`
5. `generate_deck_detailed_description`
6. `list_authoring_catalog`
7. `upsert_slide_content`
8. `generate_image`
9. `get_slide_preview`
10. `get_ai_model_status`
11. `prepare_ai_models`
12. `search_media`
13. `export_presentation`
14. `get_operation_status`

The authoritative setup, input summaries, operation lifecycle, manual workflow, and failure guidance live in
[`apps/docs/guide/work-with-web-ai/webmcp.md`](../../apps/docs/guide/work-with-web-ai/webmcp.md). The adapter's JSON
schemas remain the machine-readable source of truth.

## Recommended LocalStudio experience

### Historical hosted audit on August 26

The hosted editor at `https://localstudio.dev/editor/` was inspected in ChatGPT's in-app browser before the new authoring implementation, including actual WebMCP discovery and a read-only `get_project_snapshot` call. That deployment exposed exactly five tools:

- `create_project`
- `generate_slides`
- `generate_image`
- `translate_text`
- `get_project_snapshot`

That hosted `/editor/webmcp/` showcase presented the same five-stage workflow inside a same-origin editor iframe. Do not use this historical observation as the current source contract; deployment should be re-audited after the 14-tool implementation ships.

The current source routes public shares to `PublicDeckApp` before mounting `EditorApp`, while WebMCP registration lives in `EditorShell`. Therefore public attendee pages do not currently receive the editor tools or a public-view-specific WebMCP adapter. That separation is useful: add a dedicated public adapter instead of teaching the editor adapter about two unrelated authorization/state models.

Existing implementation assets substantially reduce build risk:

- PPTX import already accepts a `PptxImportInput` and maps imported speaker notes.
- Deck translation already handles visible text and speaker notes.
- `BrowserShareService` already publishes a stable `share.json` pointer and rewrites referenced assets, fonts, and recording audio to public URLs.
- `PublicDeckViewer` already has the selected slide, timestamped transcript segments, raw recording URL/metadata, transcript search embeddings, audio synchronization, and visible slide navigation.

The authoring orchestration contracts and semantic slide metadata are now implemented. Public-view registration remains future work, and a judge-ready run still needs working remote-storage configuration.

### Immediate product blockers

1. **Eligibility:** obtain a written answer from the hackathon manager before representing this as an eligible submission. Continue the work as a public showcase if the answer is no.
2. **Zero-setup publishing:** LocalStudio's current browser share service requires external S3-compatible storage configuration and user interaction. It is intentionally excluded from the authoring catalog until it can complete without hidden setup or external clicks.

For the challenge build, prefer a narrowly scoped managed publisher—such as a small Cloudflare Worker issuing bounded upload capability URLs into R2—over shipping reusable writer credentials to the browser. Restrict size/content types, rate-limit creation, generate unguessable share IDs, and return a stable LocalStudio public URL. Keep bring-your-own S3 as the normal product path. If a managed publisher cannot be completed by the second build day, use a documented judge account/configuration flow and show it before the demo; do not hide a preconfigured local browser as if publishing were zero setup.

### Author flow: “one intent, visible stages”

Demo prompt: **“Import this presentation, translate the entire deck to Spanish, describe it for AI, and export the finished deck.”**

Shipped tools used by this workflow:

| Tool                                 | Purpose                                                                          | Key result                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `import_powerpoint_from_url`         | Import an authorized HTTP(S), presigned object-storage, or localhost `.pptx` URL | page/byte/font counts, warnings, imported project ID          |
| `translate_deck_and_notes`           | Translate visible text, speaker notes, and existing descriptions                 | language, changed/skipped counts, failures, overflow warnings |
| `generate_deck_detailed_description` | Generate or refresh revision-linked semantic descriptions                        | described/skipped slides, language, generator, freshness      |
| `get_presentation_state`             | Read bounded state and the current revision                                      | page/element state, description freshness, revision           |
| `get_operation_status`               | Poll each long-running stage                                                     | progress, byte/slide totals, warnings, typed final result     |

Do not pass a `.pptx` as base64, binary data, a disk path, or a staged browser file. The shipped WebMCP boundary is URL-only: use an authorized HTTPS/presigned object-storage URL or a localhost HTTP server with valid CORS, MIME, filename, and size behavior. The normal File-menu picker remains available only as a human editor workflow.

Keep the operations atomic so the agent visibly chains real app capabilities. A convenience `localize_and_publish` orchestrator could be added later, but it weakens the three-step WebMCP proof and complicates recovery when import or translation produces warnings.

### Semantic slide context

The requested “transcribe the slide” should be modeled as three distinct evidence layers:

1. **Extracted slide text:** deterministic text already represented in editable elements.
2. **Semantic visual description:** generated description of charts, diagrams, spatial relationships, images, and the slide's likely communicative purpose.
3. **Speaker transcript:** timestamped words spoken during the presentation.

Store semantic descriptions in a non-rendered page metadata field, but make them inspectable/editable by the author. Include generator/version, timestamp, source slide revision/hash, language, and whether the author reviewed it. Regenerate when visual content materially changes. Descriptions should state observable content, uncertainty, and chart values where legible; they should not silently invent speaker intent. Treat both descriptions and extracted text as untrusted content when returned to an agent.

This separation improves AI grounding and accessibility while preserving provenance. Calling all three “transcription” would blur what was seen, what was said, and what was inferred—the exact distinction an evidence-seeking attendee needs.

### Future attendee/public-share tools (not shipped)

Attendee WebMCP is a separate future surface with a different read-only authorization model. If implemented later, register a small catalog only on the public-viewer route:

| Tool                        | Purpose                                                                | Why it matters                               |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `get_presentation_overview` | Title, author-provided summary, language, slide/recording availability | establishes bounded context                  |
| `get_slide_context`         | Visible text + semantic description for one/few slides                 | grounds visual questions without screenshots |
| `search_transcript`         | Bounded timestamped matches for a query                                | finds claims and exact moments               |
| `get_recording_info`        | MIME type, duration, chapters, and authorized audio URL                | gives media access without embedding bytes   |
| `navigate_to_evidence`      | Move the visible viewer to a slide/timestamp                           | keeps agent and attendee synchronized        |

Avoid an `ask_presentation` WebMCP tool as the centerpiece. The user's agent can already reason; LocalStudio's special value is authoritative retrieval and navigation over the presentation's own evidence. An app-owned Q&A tool may remain as a fallback for browsers without an agent.

For raw audio, return metadata and the published media URL, never a huge encoded payload. Make share-policy semantics explicit: public means publicly retrievable, while restricted shares must enforce the same token/session authorization in tool execution that the visible audio player uses.

### Reliability and evaluation plan

Build deterministic WebMCP evals around user outcomes, not only registration:

- discovery by route and state (editor tools absent from public view; attendee tools absent from editor);
- one natural-language goal selecting the correct tool chain;
- schema rejection and recoverable errors;
- visible UI update after each successful tool;
- cancellation of import/translation/description work;
- publish confirmation and returned URL opening the exact revision;
- transcript search returning bounded timestamped evidence;
- navigation synchronizing slide and audio position;
- injected instructions inside PPTX text/transcript/description staying treated as content, not commands;
- no-WebMCP fallback preserving every human workflow.

Chrome recommends evaluation-driven testing and its inspector for schema/call/output checks; the challenge judges may test with either ChatGPT's browser or Chrome, so run both ([Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices), [Chrome WebMCP inspector](https://developer.chrome.com/docs/ai/webmcp)).

### Concrete architecture

The shipped authoring architecture uses the editor adapter over existing application services; a public adapter is only a future option:

```text
Editor route (shipped)
  WebMcpToolAdapter
    -> schema validation
    -> AuthoringAutomationController
       -> AuthoringOperationRegistry
       -> PPTX import / translation / slide-description / media / export / share services

Public share route (future, not shipped)
  WebMcpAttendeeAdapter
    -> PublicPresentationContextService
       -> loaded ProjectDocument / selected page / recordings
    -> PublicViewerNavigationDelegate
       -> active slide / audio playback position
```

Implemented domain metadata:

```ts
interface SemanticSlideDescription {
  text: string;
  language: string;
  generatedAt: string;
  generator: string;
  sourceRevision: string;
  reviewed: boolean;
  stale: boolean;
}
```

`Page.semanticDescription` stores this optional, non-rendered metadata. The implemented generator grounds a local text
model in a bounded structured scene graph. When that model is unavailable, it creates a deterministic English
scene-graph description and translates that fallback when the requested language and translation runtime are
available; it retains English only if translation also fails. `sourceRevision` hashes meaningful slide inputs, and
later edits mark the description stale.
Rendered-canvas multimodal generation remains a future quality upgrade, not shipped behavior ([Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [Transformers.js](https://huggingface.co/docs/transformers.js/)).

`WebMcpTool` now carries titles and annotations. Bounded readers use `readOnlyHint: true`, and all results use
`untrustedContentHint: true`; imported slide/transcript content is evidence, not instructions. State-changing tools are
atomic and explicit. Passing the browser execution `AbortSignal` through every capability remains future work.

PowerPoint WebMCP import is exclusively `import_powerpoint_from_url`, with strict protocol, status, MIME, safe-name,
size, redirect, and CORS handling. It reuses the native parser, mapper, warnings, normalization, and font pipeline. There
is no WebMCP disk, binary, base64, picker, prepared-file, or staged-file contract.

### Definition of done by workflow

Verification has two complementary author paths. The clean creation journey creates a presentation, applies replace and
merge batches, inspects detailed state and a visible preview, translates text/notes/descriptions, exports a real file,
publishes an exact revision, and opens the URL in a clean browser context. Separate representative URL-import coverage
exercises valid and invalid PPTX sources, mapping, notes, warnings, and fonts. Long-running work must be followed through
`get_operation_status`, and exports must be inspected as generated files rather than accepted from a success message.

The public artifact must contain the published revision, mirrored fonts, descriptions, transcript context, and only
authorized raw recording audio. Discoverable attendee tools, transcript search, and evidence navigation remain future
work and are not part of the shipped acceptance claim.

The feature is not done from unit contracts alone. Extend the current WebMCP service-contract suite, `tests/e2e/webmcp/discover-tools.spec.ts`, PPTX import journeys, share journeys, `public-transcript-chat.spec.ts`, and public-deck viewer journeys. Then run the relevant editor/public coverage scopes, repo unit tests, typecheck, lint, and production builds. Cross-client acceptance must include ChatGPT's in-app browser and Chrome 149+ with WebMCP enabled.

## Storytelling options

### Recommended shipped story: “From file to published knowledge”

**Problem:** Decks are dead files. The creator repeats mechanical work to import, localize, verify, export, and distribute them.

**Transformation:** LocalStudio makes the browser-native authoring surface agent-readable and agent-actionable. The creator's agent works through visible, deterministic tools, while the person can inspect the same canvas, progress, warnings, downloads, and exact published result.

**Payoff:** One editable artifact crosses language and publishing boundaries without a separate MCP server or brittle UI automation. Attendee-side WebMCP can extend this story later but is not required for the shipped demo.

Suggested line: **“Your deck should not stop being useful when the talk ends.”**

### Alternative and future angles

- **Future — the same deck, two agents:** the creator's agent builds and publishes; each attendee's agent helps them understand after a separately authorized attendee adapter ships.
- **Accessibility as agent infrastructure:** text, visual descriptions, transcript, and audio serve both human accessibility and trustworthy AI grounding. Avoid claiming compliance unless actually audited.
- **Local-first creation, universally useful result:** emphasize that private authoring can remain local/browser-native while only the chosen revision and assets are published.
- **Future — evidence, not hallucination:** when asked “What did the speaker say about X?”, an attendee agent could return the spoken excerpt's timestamp, slide context, and a navigation action rather than guessing from slide pixels.
- **Future — presentations as agent-native websites:** a public link could become a domain-specific interface with inspectable attendee capabilities rather than a passive slideshow.

### Three-minute demo spine

1. **0:00–0:20 — Stakes:** show a foreign-language `.pptx`; state that creators lose time and attendees lose context.
2. **0:20–1:20 — Author agent:** discover the 14 tools, import a CORS-enabled PPTX URL, and poll byte/slide progress. Translate the deck and notes, generate fresh semantic descriptions, and show the visible canvas changes.
3. **1:20–2:15 — Verify and deliver:** focus the translated slide for visual inspection, read the exact revision and semantic description, then export one format. Treat public sharing as a separately configured human workflow until it can run hands-off.
4. **2:15–2:45 — Breadth and trust:** briefly show the editable cards for catalogs, media, AI status/preparation, image generation, and operation status. Reveal read-only/untrusted annotations and strict schemas.
5. **2:45–3:00 — Thesis:** “One presentation workflow, shared visibly by a person and their agent.”

The demo should use a short, visually distinctive 3–5 slide deck, one obvious translation change, one chart or diagram whose meaning is absent from plain text, and one recorded sentence that adds information not present on the slide. That forces every claimed context layer to earn its place.

## Delivered scope and future work

### Delivered authoring scope

1. Fifteen production authoring tools with strict schemas and annotations.
2. URL-only PPTX import through the native parsing/font pipeline.
3. Translate → describe → preview → export/publish with visible state and verifiable outputs.
4. Bounded state, catalogs, media results, operation progress, warnings, and final results.
5. Exact-revision publishing with fonts, descriptions, transcript context, and authorized raw audio.
6. Editable showcase cards and browser/unit coverage for discovery, dispatch, schema failures, generated files, and clean-context publication.

Eligibility remains an external submission requirement: obtain a written answer from the hackathon manager before representing LocalStudio as an eligible prize entry.

### Future, separate scope

- attendee-route WebMCP retrieval and navigation tools;
- transcript search and cross-modal evidence deep links;
- citeable deep links such as `?slide=4&t=83s`;
- author review/edit UI for generated descriptions;
- chapter/summary generation from combined slide and speech evidence;
- exportable accessible transcript package;
- audience tools that respect a presenter-controlled visibility policy per context layer.

## Historical execution plan

The following plan was written before implementation and is retained only as provenance. It is not the current product contract; use the shipped authoring catalog and guide above for testing and submission claims.

| Date                  | Outcome                                                                                                         | Exit test                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Aug 26                | Eligibility email/question sent; publish-path spike; baseline screenshots/tool list/commit recorded             | Written question exists; clean-browser publish strategy chosen                    |
| Aug 27                | WebMCP contract foundation: current draft types, titles, annotations, cancellation, route-specific adapter seam | Existing tools still discover/execute; metadata tests green                       |
| Aug 28                | Author import tools and deterministic sample-PPTX URL                                                           | Agent imports sample in fresh browser; warnings/counts returned                   |
| Aug 29                | Semantic description model, generation service, stale-state handling, author inspection UI                      | 3–5 slide demo deck descriptions are accurate and editable                        |
| Aug 30                | Publish tool and clean-browser storage path                                                                     | Returned URL opens exact translated/described revision without hidden local setup |
| Aug 31                | Public attendee retrieval/navigation tools                                                                      | Deferred as separate future scope                                                 |
| Sep 1                 | Full authoring E2E, injection cases, ChatGPT + Chrome acceptance                                                | Demo journey passes repeatedly in both target clients                             |
| Sep 2                 | Deploy freeze; README/challenge delta; submission copy; record/edit video                                       | Public repo/license/live URL ready; video under 3:00                              |
| Sep 3 before 5 PM BRT | Final smoke test and submission                                                                                 | All URLs public and stable through judging period                                 |

Recommended commit slices:

1. `feat(webmcp): align tool contracts with the current draft`
2. `feat(webmcp): import remote powerpoint decks`
3. `feat(slides): add semantic descriptions and local generation`
4. `feat(webmcp): publish localized presentations`
5. `test(webmcp): cover authoring and clean-context publishing journeys`
6. `docs(webmcp): document challenge delta and judge workflow`

## Additional ideas ranked by story value

1. **Evidence deep links:** return/share `?slide=4&t=83s`. This makes every answer verifiable and produces a memorable demo payoff for modest scope.
2. **What changed in translation:** a read-only tool reports which slides changed, which terms were preserved, and which layouts may overflow. It turns translation from a black box into collaboration.
3. **Ask what was shown vs. what was said:** expose separate evidence channels and let the attendee request either or compare them. This is more original than generic deck chat.
4. **Audience-language lens:** attendee chooses a language and receives translated slide context/transcript excerpts without mutating the canonical deck. Strong accessibility/internationalization story, but keep it after the main author translation path.
5. **Presenter follow-up pack:** generate bounded action items, glossary, and cited recap from slide descriptions plus transcript. Useful, but it should consume the evidence tools rather than become another opaque mega-tool.
6. **Semantic freshness indicator:** show authors which slide descriptions are stale after edits. This makes the hidden AI context trustworthy and demo-visible.
7. **Privacy manifest:** before publishing, show exactly which layers will become public—slide pixels/text, semantic descriptions, transcript, and raw audio—with per-layer controls. This strengthens the human-in-the-loop thesis.
8. **Live audience mode:** during a talk, WebMCP tools return the current slide and live transcript window. Compelling, but higher synchronization risk; keep it as a post-submission direction.

Avoid spending the deadline on generic chat UI, dozens of low-value editing tools, or an all-in-one orchestration tool. The current product already has presentation AI; the shipped novelty is the trustworthy authoring lifecycle. A two-sided WebMCP surface remains future work.

## Primary sources

- [WebMCP Challenge overview](https://webmcp.devpost.com/)
- [WebMCP Challenge official rules](https://webmcp.devpost.com/rules)
- [WebMCP Challenge resources](https://webmcp.devpost.com/resources)
- [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/)
- [WebMCP source repository and explainer](https://github.com/webmachinelearning/webmcp)
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [OpenAI site tools guide](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI Showcase](https://developers.openai.com/showcase)
