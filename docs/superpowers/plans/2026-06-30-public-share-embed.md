# Public Share Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Canva-style Share panel that creates a public read-only slide URL, copies it to the clipboard, exposes iframe embed code, moves Download into Share, and launches Present from Share.

**Architecture:** Add a `ShareService` boundary with a browser-backed adapter for the first working implementation. Add public viewer routes that read shared deck records and render one read-only slide at a time using the existing `CanvasWorkspace` in read-only presentation mode.

**Tech Stack:** React 19, TypeScript, Vite, React Konva, Vitest, Testing Library, browser `localStorage`, Clipboard API.

---

## File Structure

- Create `apps/editor/src/services/shareService.ts`: share service types plus browser storage adapter.
- Modify `apps/editor/src/services/interfaces.ts`: export `ShareService`.
- Modify `apps/editor/src/app/composition.ts`: inject `BrowserShareService`.
- Create `apps/editor/src/ui/share/SharePanel.tsx`: Canva-style Share panel with Copy link, Download, Present, Public view link, and Embed code actions.
- Create `apps/editor/src/ui/share/PublicDeckViewer.tsx`: read-only public and embed viewer.
- Modify `apps/editor/src/App.tsx`: route `/s/:shareId` and `/embed/:shareId` to public viewer.
- Modify `apps/editor/src/ui/editor/TopToolbar.tsx`: replace standalone Export button with Share button.
- Modify `apps/editor/src/ui/editor/EditorShell.tsx`: own Share panel state, wire Share actions, move Download action into Share, and expose Present action from Share.
- Modify `apps/editor/src/app/styles.css`: Share panel and public viewer styling.
- Add tests under `apps/editor/tests/unit/services/shareService.test.ts`, `apps/editor/tests/unit/ui/share/SharePanel.test.tsx`, `apps/editor/tests/unit/ui/share/PublicDeckViewer.test.tsx`, and update existing editor/app tests.

## Task 1: Share Service

**Files:**
- Create: `apps/editor/src/services/shareService.ts`
- Modify: `apps/editor/src/services/interfaces.ts`
- Modify: `apps/editor/src/app/composition.ts`
- Test: `apps/editor/tests/unit/services/shareService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create tests for: creating an unlisted share, updating the same share, generating public URL, generating iframe HTML, and rejecting missing shares.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/services/shareService.test.ts`

Expected: fail because the service file does not exist.

- [ ] **Step 3: Implement `ShareService`**

Use localStorage key `localstudio.ai.public-shares.v1`. Generate IDs with `crypto.randomUUID()` when available and a timestamp fallback in tests. Store sanitized `ProjectDocument` data, created/updated timestamps, public URL, and embed URL.

- [ ] **Step 4: Run service test**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/services/shareService.test.ts`

Expected: pass.

## Task 2: Public Viewer

**Files:**
- Create: `apps/editor/src/ui/share/PublicDeckViewer.tsx`
- Modify: `apps/editor/src/App.tsx`
- Modify: `apps/editor/src/app/styles.css`
- Test: `apps/editor/tests/unit/ui/share/PublicDeckViewer.test.tsx`
- Test: `apps/editor/tests/unit/app/App.test.tsx`

- [ ] **Step 1: Write failing viewer tests**

Cover `/s/:shareId`, `/embed/:shareId`, next/back navigation, disabled bounds, and missing share.

- [ ] **Step 2: Run viewer tests to verify failure**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/ui/share/PublicDeckViewer.test.tsx apps/editor/tests/unit/app/App.test.tsx`

Expected: fail because viewer routes do not exist.

- [ ] **Step 3: Implement viewer and routes**

Use `CanvasWorkspace` with `readOnly`, `presentationMode`, empty selection, active page state, and compact controls.

- [ ] **Step 4: Run viewer tests**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/ui/share/PublicDeckViewer.test.tsx apps/editor/tests/unit/app/App.test.tsx`

Expected: pass.

## Task 3: Share Panel

**Files:**
- Create: `apps/editor/src/ui/share/SharePanel.tsx`
- Modify: `apps/editor/src/app/styles.css`
- Test: `apps/editor/tests/unit/ui/share/SharePanel.test.tsx`

- [ ] **Step 1: Write failing panel tests**

Cover not-shared state, Copy link create/copy flow, URL and embed code display, clipboard fallback display, Download click, Present click, and Public view link click.

- [ ] **Step 2: Run panel tests to verify failure**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/ui/share/SharePanel.test.tsx`

Expected: fail because the panel does not exist.

- [ ] **Step 3: Implement Share panel**

Use accessible buttons and status text. Do not render unavailable add-people or access-list controls. Use the Canva-inspired action grid with Copy link as the primary action.

- [ ] **Step 4: Run panel tests**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/ui/share/SharePanel.test.tsx`

Expected: pass.

## Task 4: Editor Integration And Auto-Sync

**Files:**
- Modify: `apps/editor/src/ui/editor/TopToolbar.tsx`
- Modify: `apps/editor/src/ui/editor/EditorShell.tsx`
- Modify: `apps/editor/tests/unit/ui/editor/EditorShell.test.tsx`

- [ ] **Step 1: Write failing editor tests**

Update the export test so the active-slide PNG export is triggered through Share > Download. Add tests for opening Share, Copy link, and Present.

- [ ] **Step 2: Run editor tests to verify failure**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/ui/editor/EditorShell.test.tsx`

Expected: fail because Share is not wired.

- [ ] **Step 3: Wire editor integration**

Replace the toolbar Export button with Share. In `EditorShell`, open `SharePanel`, call `ShareService.createShare`, call `ShareService.updateShare` after shared project changes with debounce, and call existing fullscreen/export handlers from Share panel actions.

- [ ] **Step 4: Run editor tests**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/ui/editor/EditorShell.test.tsx`

Expected: pass.

## Task 5: Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run focused tests**

Run: `npm run test --workspace @localstudio/editor -- apps/editor/tests/unit/services/shareService.test.ts apps/editor/tests/unit/ui/share/SharePanel.test.tsx apps/editor/tests/unit/ui/share/PublicDeckViewer.test.tsx apps/editor/tests/unit/ui/editor/EditorShell.test.tsx apps/editor/tests/unit/app/App.test.tsx`

Expected: pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace @localstudio/editor`

Expected: pass.

- [ ] **Step 3: Run full editor tests**

Run: `npm run test --workspace @localstudio/editor`

Expected: pass.

- [ ] **Step 4: Run root lint and build if time allows**

Run: `npm run lint`

Run: `npm run build --workspace @localstudio/editor`

Expected: pass.
