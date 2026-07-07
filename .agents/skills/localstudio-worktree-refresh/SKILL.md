---
name: localstudio-worktree-refresh
description: LocalStudio worktree freshness workflow. Use whenever Codex creates, opens, switches to, resumes, or starts implementation inside a LocalStudio/canva-webai-clone git worktree, before editing code, so the worktree fetches remote main and fast-forwards safely instead of working from an outdated base.
---

# LocalStudio Worktree Refresh

## Overview

Use this skill before implementation starts in any LocalStudio worktree. The goal is to update the worktree from `origin/main` without losing local work or hiding branch divergence.

## Refresh Workflow

1. Inspect the worktree before network or merge commands.
   ```bash
   git status --short --branch
   git remote get-url origin
   git branch --show-current
   ```

2. Stop if the worktree has local changes.
   - Do not stash, reset, checkout, or overwrite user changes automatically.
   - Report the dirty files and ask before continuing, unless the user explicitly told you those changes are yours to manage.

3. Fetch the latest remote main.
   ```bash
   git fetch origin main
   ```
   - If network/sandboxing blocks this command, rerun it with approval/escalation.
   - Do this before trusting local `origin/main` state.

4. Confirm whether the current `HEAD` can fast-forward to `origin/main`.
   ```bash
   git merge-base --is-ancestor HEAD origin/main
   ```

5. Fast-forward only when safe.
   ```bash
   git merge --ff-only origin/main
   ```
   - This is valid for detached worktrees and branch worktrees when `HEAD` is an ancestor of `origin/main`.
   - If the command says "Already up to date.", treat the worktree as fresh.

6. Stop on divergence.
   - If `HEAD` is not an ancestor of `origin/main`, do not rebase or merge manually.
   - Report the branch, `git status --short --branch`, and ask how the user wants to reconcile the worktree.

7. Report the refreshed base.
   ```bash
   git rev-parse --short HEAD
   git log -1 --oneline
   ```

## Handoff Rules

- Mention the exact refresh command sequence used.
- If the refresh was skipped because the worktree was dirty or divergent, say that clearly before implementation starts.
- Never use `git reset --hard`, `git checkout --`, or destructive cleanup as part of this skill unless the user explicitly requested that destructive action.
- After refreshing, continue with the task using the repo's other applicable skills, such as `writing-typescript` for TypeScript/source edits and `localstudio-finish-checks` before final handoff.
