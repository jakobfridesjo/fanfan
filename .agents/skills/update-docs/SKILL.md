---
name: update-docs
description: Bring documentation back in sync with the code. Finds when a doc was last edited in git, diffs the repo since that commit, and updates the doc to reflect what changed. Triggers on "update docs", "update documentation", "refresh docs", "sync docs", or any request to update/refresh/sync documentation (README.md, docs/*.md, CLAUDE.md/AGENTS.md), and when a doc looks stale after code changes.
---

# Update documentation from git history

Update a documentation file so it matches the current state of the code, using the git history since the doc was last edited as the source of truth for what changed.

## Arguments

An optional path to a specific doc file. Without an argument, sweep the standard docs: `README.md`, `docs/*.md`, and every tracked `AGENTS.md` (`git ls-files '*AGENTS.md'`: the root and `src/shared/ui/`). Each `CLAUDE.md` is a symlink to its sibling `AGENTS.md` — edit only `AGENTS.md`, and restore the symlink if a `CLAUDE.md` has become a regular file. A rule belongs in the most specific `AGENTS.md` that covers it; everything not specific to `src/shared/ui/` goes in the root one.

## Procedure

Run these steps per doc file:

### 1. Find the doc's last edit

```bash
git log -1 --format="%H %cs %s" -- <doc>
```

If the doc has no history (new/untracked), skip the diff and instead verify the doc against the current code directly.

### 2. Collect what changed since then

Start with an overview, excluding the doc itself and noise:

```bash
git diff <commit>..HEAD --stat -- . ':!<doc>' ':!*.lock' ':!pnpm-lock.yaml' ':!*.gen.ts'
```

Only committed changes count — always diff `<commit>..HEAD`, never against the working tree; ignore uncommitted work. If the diff is large, don't read it wholesale — use the stat output to pick the files relevant to the doc's scope, then diff those individually:

```bash
git diff <commit>..HEAD -- <relevant paths>
```

Also check `git log --oneline <commit>..HEAD` — commit messages often summarize intent (renames, removals, new features) faster than the raw diff.

### 3. Read the doc and map claims to the diff

Read the doc in full. For each concrete claim it makes — commands, file paths, directory layout, config options, env vars, API endpoints, tool versions, feature descriptions — check whether the diff invalidates it:

- **Stale**: the diff renamed/removed/changed what the doc describes → fix it.
- **Missing**: the diff added something squarely within the doc's existing scope (e.g. a new mise task in a doc that lists mise tasks) → add it, matching the doc's existing level of detail.
- **Unrelated**: the diff touched things the doc never covered → leave the doc alone. Do not grow a doc's scope; this skill syncs, it doesn't author.

When a claim looks stale but the diff is ambiguous, verify against the current code (read the file, run the command with `--help`) rather than guessing from the diff.

### 4. Edit conservatively

- Change only what the diff justifies. Preserve the doc's structure, tone, and formatting.
- Do not rewrite prose that is still accurate.
- Commands the doc tells the reader to run should be verified runnable when cheap to do so (e.g. `mise tasks` to confirm a task name exists).

### 5. Report

Summarize per doc: what was stale and why (which commit/change invalidated it), what was added, and anything found stale that you could NOT confidently fix — flag those for the user instead of guessing.

If a doc needed no changes, say so explicitly with the commit range checked, e.g. "README.md: checked f57a003..HEAD, still accurate."
