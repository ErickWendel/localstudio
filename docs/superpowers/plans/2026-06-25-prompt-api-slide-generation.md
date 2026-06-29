# Prompt-to-Slide Generation Status

Date: 2026-06-25
Last updated: 2026-06-26

## Goal

Generate editable LocalStudio.dev slide content from the main prompt bar using a local LLM provider. The LLM returns structured JSON tasks and element payloads, and the editor applies them progressively through immutable document commands.

## Implemented

- Default prompt-bar mode submits slide-structure/content prompts for the active page.
- `+ > Create image` switches the prompt bar to image generation mode. Clearing the chip returns to normal slide prompting.
- Prompt requests that ask to generate an image while not in create-image mode are blocked with guidance to use the `+` menu.
- Prompt files live under `src/services/prompts/`.
- Generated slide schema, validators, clamping, and defaults live in `src/domain/generatedSlide.ts`.
- Prompt-to-slide uses staged generation:
  - ask for a structured task list;
  - apply page/background tasks first;
  - request one concrete element payload at a time;
  - commit each element through immutable commands for progressive feedback.
- Placeholder image requests use a bundled local placeholder asset.
- User-provided `https://` image URLs are allowed as remote image assets.
- Chrome Built-in Prompt API and Gemma 4 WebGPU are selectable through the LLM Model provider card.

## Current Constraints

- Active-page generation only.
- No multi-slide deck generation yet.
- No schema repair/retry UX yet.
- No prompt history yet.
- Generated layouts still need prompt-quality iteration; the model can produce small or overly conservative layouts.

## Remaining Work

- Improve task and element prompts so common requests produce stronger layouts by default.
- Add multi-slide deck generation.
- Add schema repair/retry flow for invalid structured output.
- Add generation history and cancellation.
- Add richer progress messaging by task name.
- Reintroduce browser e2e coverage only through a future explicit plan after the UX stabilizes.

## Verification Target

For prompt generation changes, run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

Browser e2e is not part of the active toolchain.
