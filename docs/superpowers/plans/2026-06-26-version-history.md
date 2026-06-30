# Version History Implementation Plan

> **For agentic workers:** Keep this plan updated with checkbox progress. Implement in small slices, keep the feature file-backed, and use the active lint/typecheck/unit/build toolchain unless browser e2e is explicitly reintroduced in a future plan.

**Goal:** Add a Google Slides-style local version history to LocalStudio.dev. The header gets a history/time icon near the persistence icon, hover shows the last edited date-time, click opens version history, selecting a version previews it at the first detected change, and restoring a version writes it back as the current project.

**Storage:** Store history inside the user-selected project folder:

```txt
project.json
assets/
cache/
history/
  manifest.json
  versions/
    2026-06-26T15-42-10-123Z.json
```

`history/manifest.json` contains `schemaVersion`, `projectId`, `latestVersionId`, and an ordered list of version entries. Each version entry points at a full `ProjectDocument` snapshot in `history/versions/`.

---

## Current Status

- [x] Plan saved in the project plans folder.
- [x] Implementation started in `codex/version-history` worktree.

## Implementation Checklist

### Task 1: Repository and File Format

- [x] Add version history domain/service types:
  - `VersionHistoryManifest`
  - `VersionHistoryEntry`
  - `VersionSnapshotMetadata`
  - `ProjectVersionHistoryRepository`
- [x] Implement File System Access-backed history storage next to the current project repository.
- [x] Ensure `history/manifest.json` and `history/versions/` are created lazily only when persistence is enabled.
- [x] Save full `ProjectDocument` snapshots for MVP simplicity.
- [x] Keep max retention at 100 versions and delete oldest version files best-effort.
- [ ] Do not duplicate asset files per version; history snapshots reference the same project assets.

### Task 2: Diff and First Change Detection

- [x] Compare previous project vs next project when creating a snapshot.
- [x] Compute:
  - `changeCount`
  - `summary`
  - `firstChangedPageId`
  - `firstChangedElementId`
- [x] Detect page order/name/background changes, added/deleted pages, element add/delete/update, and asset metadata changes.
- [ ] Treat page-level changes as slide-frame highlights when no element-level target exists.

### Task 3: View Model Integration

- [x] Add view-model state:
  - `versionHistoryOpen`
  - `versionHistoryEntries`
  - `selectedVersionId`
  - `previewProject`
  - `highlightVersionChanges`
  - `lastEditedAt`
- [x] Create snapshots after document-changing commits only when persistence is enabled and a project folder exists.
- [x] Coalesce noisy edits with a 60-second minimum interval.
- [ ] Force snapshots for meaningful operations: import image, delete page, restore version, background removal, generated image, prompt-generated slide.
- [x] While previewing an old version, disable normal editing.
- [x] Selecting a version loads the snapshot, activates `firstChangedPageId`, selects `firstChangedElementId` when present, and scrolls to that page.
- [x] Restoring a version writes the snapshot to `project.json`, creates a new version entry, exits preview mode, and returns to normal editing.

### Task 4: UI

- [x] Add a history/time icon near the persistence icon in the header.
- [x] Hover/title text shows `Last edited <date-time>`.
- [x] Disable the icon when persistence is disabled or history is unavailable.
- [x] Add a right-side `Version history` panel:
  - filter dropdown: `All versions`
  - entries grouped/listed by date-time
  - current version label
  - author line: MVP `Local user`
  - selected version highlighted
  - `Highlight changes` toggle
- [ ] Add preview mode header with back action, selected timestamp, and `Restore this version`.
- [x] Use LocalStudio.dev black/green styling rather than copying Google’s light theme.

### Task 5: Tests

- [ ] Unit tests for manifest read/write, snapshot save/load, retention cleanup, and restore.
- [x] Unit tests for first-change detection.
- [ ] UI/view-model tests:
  - history icon shows last edited time.
  - click opens version history panel.
  - selecting a version loads preview and activates first changed page.
  - restore replaces current project and exits preview.
  - editing controls are disabled during preview.
- [ ] Run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`

## Important Assumptions

- Version history exists only when persistence is enabled.
- Full snapshots are acceptable for MVP correctness; diff-based storage can come later.
- Asset cleanup must treat version snapshots as references before deleting old assets, otherwise old versions may restore with missing images.
- MVP author name is `Local user`.
- Clicking a version means previewing that version and moving the editor to the first detected change.
