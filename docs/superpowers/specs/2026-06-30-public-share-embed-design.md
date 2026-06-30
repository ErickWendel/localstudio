# Public Share And Embed Design

Date: 2026-06-30

## Summary

LocalStudio.ai should add a Canva-style Share button that acts as the main sharing and presentation hub for a deck. The first version creates an unlisted public view link, copies it to the clipboard, shows the link in the Share panel, and exposes iframe embed code for web pages.

The public page is a read-only slide preview. Viewers can move to the previous or next slide. They cannot edit, comment, duplicate, download source files, or access AI/editor controls.

This design intentionally keeps Markdown export, animation syntax, auth, collaboration, visitor analytics, revoke flows, and owner dashboards out of the MVP. Markdown remains a future export format, not the public preview renderer for this feature.

## Goals

- Replace the standalone top-toolbar Export action with a Canva-style Share button.
- Move Download/export and Present/fullscreen actions into the Share panel.
- Create an unlisted public URL without accounts or sign-in.
- Copy the public URL to the clipboard when the user clicks Copy link.
- Show the generated public URL and iframe embed code after publishing.
- Keep the shared URL updated with the latest deck state after the first publish.
- Render public decks in a read-only viewer with next/back navigation.

## Non-Goals

- Accounts, authentication, teams, people access lists, or add-people flows.
- Revoking, deleting, claiming, transferring, or managing shared links.
- Per-user permissions or password-protected links.
- Comments, reactions, analytics, real visitor counts, or notification settings.
- Markdown-based rendering, Markdown export, or animation authoring.
- YouTube publishing, template links, move-to-folder, or marketplace behaviors.
- Pixel-perfect snapshot rendering as the first implementation path.

## Current Context

The editor already has:

- A top toolbar with an Export button using the `ios_share` icon.
- `ExportService` for current-page PNG download naming and `downloadDataUrl`.
- Fullscreen presentation mode controlled from the editor footer.
- A normalized `ProjectDocument` model with pages, assets, and elements.
- A Konva-backed slide renderer that can already disable presentation/editor overlays in some contexts.

The feature should follow the current service-boundary style: UI depends on injected interfaces, and browser/server adapters live behind services.

## Product Decisions

- Public sharing uses a hosted public URL, not a local static bundle.
- The MVP has no auth.
- Shared links are unlisted and must use unguessable IDs.
- A shared deck reflects the latest synced project state after the first share.
- The Share panel provides both a public URL and iframe embed code.
- The public preview uses the deck model directly for now.
- Snapshot images may be added later for performance or visual-fidelity optimization.

## Share Panel UX

The top-right toolbar should expose a primary Share button. Clicking it opens a Canva-inspired panel.

Before a deck is shared, the panel shows:

- Title: Share design.
- State: Not shared yet.
- Primary action: Copy link.
- Secondary actions grid:
  - Download.
  - Present.
  - Public view link, disabled until a share exists.
  - Embed code, disabled until a share exists.

When the user clicks Copy link:

1. The editor creates the public share if none exists.
2. The public URL is copied to the clipboard.
3. The generated URL is shown in the panel.
4. The panel status changes to Published or Copied.

After the deck is shared, the panel shows:

- Access state: Unlisted: anyone with the link can view.
- Public URL with copy action.
- Iframe embed code with copy action.
- Sync state: syncing, published, copied, sync failed, or updating.
- Last synced timestamp when available.
- Download and Present actions.

People-with-access, add-people, access-level dropdowns, settings, and visitor counts are not functional in the MVP. If visual placeholders are used for layout parity, they must not imply unavailable capabilities.

## Download And Present

Download moves from the standalone Export button into the Share panel. The initial Download action can preserve the current behavior: export the active slide as PNG. The design should leave room for future deck-level PDF export once that export path exists.

Present launches the existing fullscreen presentation mode. It should close the Share panel and enter the same presentation mode currently controlled from the footer.

## Public Viewer UX

The public URL loads a read-only deck viewer. The viewer shows one slide at a time and provides:

- Previous slide button.
- Next slide button.
- Current slide position, for example 1 / 5.
- Keyboard navigation with left/right arrows.
- Disabled previous button on the first slide.
- Disabled next button on the last slide.

The viewer must not render editor chrome, selection outlines, drag handles, AI panels, persistence controls, version history, prompt bars, or project mutation actions.

The iframe embed URL should use a dedicated `/embed/:shareId` route. The embed version should be compact and avoid unnecessary page chrome.

## Architecture

Use a hybrid architecture, implemented first as live JSON rendering.

### Editor-Side Services

Add a `ShareService` interface that supports:

- `createShare(project)`.
- `updateShare(shareId, project)`.
- `getShareMetadata(shareId)`.
- `getPublicUrl(shareId)`.
- `getEmbedHtml(shareId)`.

The UI should depend on this interface through `AppServices`, matching the existing service-injection pattern.

### Shared Deck Payload

The canonical payload is the project model plus the assets needed for public rendering. The payload must exclude transient editor state:

- selection
- zoom
- active tab
- open panels
- version-history panel state
- crop/selection modes
- AI provider settings
- local filesystem handles
- object URLs that cannot work outside the editor session

Assets must be converted into public URLs or uploaded alongside the share payload. A public viewer must never depend on local File System Access handles or browser-only object URLs from the authoring session.

### Public Storage

The public share record should include:

- unguessable share ID
- latest deck payload
- public asset references
- created timestamp
- updated timestamp
- schema version
- optional future fields for snapshot images

No owner identity is required in the MVP. Because there is no auth, the local editor is the only place that remembers the share ID for future updates.

### Public Routes

Recommended routes:

- `/s/:shareId` for normal public viewing.
- `/embed/:shareId` for iframe embedding.

Both routes load the public share record, validate it, and render a read-only deck.

## Sync Behavior

First Copy link creates the share record and copies the public URL. After that, meaningful project changes should sync to the same share ID.

Sync should be debounced so editing does not publish on every keystroke. A failed sync should leave the local editor usable and show `Sync failed` in the Share panel with a retry action.

The editor should keep the latest successful share metadata with the local project or local project config so reopening the project can continue updating the same public URL.

## Error Handling

- Share creation failure: keep the panel open, show `Could not create public link`, and provide retry.
- Clipboard failure: show the URL so the user can copy manually.
- Update failure: show `Sync failed` and provide retry.
- Missing share: public viewer shows a minimal Deck not found state.
- Invalid deck payload: public viewer shows Deck could not be loaded.
- Missing public asset: render a missing-image placeholder and keep navigation working.
- Offline/network unavailable: keep local editing available and show that sharing requires a connection.

## Testing

Unit tests:

- Share URL and iframe embed code generation.
- `ShareService` create/update success and failure behavior.
- Payload sanitization excludes transient editor state and local-only asset references.

Component tests:

- Share panel not-shared state.
- Copy link creates share, copies the URL, and reveals the public URL.
- Published state shows URL and iframe code.
- Sync failed state exposes retry.
- Download action calls the existing export path from the Share panel.
- Present action enters fullscreen presentation mode.
- Public viewer renders a shared deck read-only.
- Public viewer previous/next navigation and disabled bounds.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Open Implementation Notes

- The design does not prescribe the backend provider. The implementation plan should choose a pragmatic storage/API layer that fits the current deployment target.
- If live JSON rendering exposes visual fidelity problems, add generated preview images as an optimization without changing the public URL contract.
- Markdown export should be designed separately later so this MVP remains focused on public preview and embed sharing.
