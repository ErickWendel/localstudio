# Storage, Setup, and Translation Status

Date: 2026-06-25
Last updated: 2026-06-26

## Goal

Keep LocalStudio.dev local-first: projects save to disk through the File System Access API, AI setup remains explicit, and translation works through the selected local browser provider.

## Implemented

Storage:

- Project folders use `project.json`, `assets/`, `config/localstudio.json`, and `cache/`.
- Imported, pasted, generated, and transformed image assets can be written to `assets/`.
- Autosave runs after document changes when persistence is enabled.
- Startup can restore the project referenced by `?project=<name>` or the recent project handle.
- `File > New Project` opens a blank project in a new tab and removes the one-shot query flag after creation.
- `File > Import Project` opens an existing project folder by reading `project.json`.

Setup:

- First-run/readiness checks exist for File System Access and local AI capabilities.
- AI Tools exposes provider/model readiness and model preparation progress.

Translation:

- Translation works for selected text, current page, and full deck.
- Entry points: selected-text toolbar, page translate control, and `Edit > Translate Deck`.
- Target language is chosen in AI Tools and reused by text/page/deck translation.
- The supported language list is hard-coded, sorted by language name, and shows flags at the end of option labels.
- Language detection runs before translation, with alias normalization for cases such as `gl -> es`.
- Pair/model preparation progress appears in the translation configuration card.
- Repeated translation clicks are guarded while a translation is already in flight.
- Translated text gets first-pass box fitting to reduce avoidable wrapping/layout breakage.
- Translation provider selection supports Chrome Built-in Translator and TranslateGemma WebGPU.

## Remaining Work

Storage:

- Delete stale unreferenced asset files from `assets/`, while treating version-history snapshots as references.
- Store durable generated masks/previews under `cache/` when those artifacts become project data.
- Add clearer notices for missing assets, denied permissions, invalid `project.json`, unavailable File System Access API, and partial writes.
- Keep persistence disabled when folder permission is denied.

Translation:

- Add manual overflow controls: fit text, expand text box, accept wrapping, or reset layout.
- Improve recovery guidance for unsupported language pairs, failed provider downloads, offline cases, and denied downloads.
- Verify Chrome Translator and TranslateGemma behavior on target Chrome/browser builds.
- Reintroduce browser e2e coverage for target-language selection, provider selection, preparation progress, selected text, page, deck, repeated-click guard, and reverse translation only through a future explicit plan.

## Verification Target

For storage/translation changes, run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

Browser e2e is not part of the active toolchain.
