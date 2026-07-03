# LocalStudio Contexts

Use this reference when working inside the LocalStudio `canva-webai-clone` repo.

## Source Of Truth

- `apps/editor/tests/unit/testOrganization.test.ts` enforces the source organization rules.
- Keep tests out of `src`.
- Keep at most one public value export per source file.
- Allow `export type` and `export interface` when they describe the owning implementation.
- Reject `index.ts` barrels and value re-export loop-through files.
- Reject loose implementation files directly under scoped module roots.

## Editor Source Contexts

- App routing: `apps/editor/src/app/routing`.
- Domain concepts: `apps/editor/src/domain/assets`, `documents`, `generated-slides`, `images`, and `projects`.
- Domain commands: `apps/editor/src/domain/commands/elements`, `generated-slides`, and `shared`.
- Services: `apps/editor/src/services/automation`, `background-removal`, `browser`, `contracts`, `exporting`, `ids`, `image-generation`, `mirror`, `model-setup`, `prompting`, `sharing`, `storage`, `testing`, `translation`, and `webmcp`.
- Editor UI: `apps/editor/src/ui/editor/animation`, `background-selection`, `browser`, `canvas`, `media`, `panels`, `persistence`, `prompting`, `shell`, `state`, `text`, `toolbars`, and `translation`.
- Shared UI areas: `apps/editor/src/ui/components`, `setup`, `share`, and `webmcp`.
- Vendor code stays under `apps/editor/src/vendor` and should not absorb app-owned abstractions.

## Landing And Packages

- Landing route helpers live under `apps/landing/src/routing`.
- Add new landing content, layout, feature, or workflow code under explicit context folders instead of loose files when the feature grows beyond a single owner.
- Package source roots such as `packages/brand/src` follow the same one-value-export and direct-import rules.

## Verification Commands

- `npm run test --workspace @localstudio/editor -- tests/unit/testOrganization.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
