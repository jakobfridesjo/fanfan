# skills.sh

This repo uses [skills.sh](https://skills.sh/) to install reusable AI-agent skills. Project skills live under `.agents/skills/` (`.claude/skills` is a symlink to it). The directory is gitignored: installed skills are recorded in `skills-lock.json` and restored with `mise skills:install`, which `mise setup` runs (as the `skills` deps provider) when `skills-lock.json` or `mise.lock` changes. The same task runs `mise skills sync`, which links the skills that mise-installed tools ship (hk's `hk-configure` and `hk-debug`) for the tool version currently pinned; a tool upgrade changes `mise.lock`, so `mise setup` reruns it. A skill written for this repo (`update-docs`) is committed with `git add -f` instead of going in the lock file.

`mise skills:install` only restores skills that are missing; it leaves an installed skill alone even when it no longer matches the lock. `mise skills:update` reinstalls every locked skill from its upstream repo and rewrites `skills-lock.json` with the new hashes. The lock records no commit, so this takes whatever upstream has now: review the skill and lock diffs and commit them.

## Common commands

Run from the repo root:

```bash
pnpx skills find <query>                 # search skills
pnpx skills add <owner>/<repo>           # install a skill package
pnpx skills ls                           # list project skills
pnpx skills update                       # update project skills
pnpx skills remove <name>                # remove a skill
pnpx skills experimental_install         # restore from skills-lock.json (`mise skills:install`)
```

Useful flags:

- `-g, --global` installs/lists/updates/removes user-level skills instead of project skills.
- `-a, --agent <agents>` targets agents, for example `claude-code cursor` or `*`.
- `-s, --skill <skills>` selects specific skills from a package, or `*`.
- `-y, --yes` skips prompts; `--copy` copies files instead of symlinking.

## Authoring a skill

Create a starter skill:

```bash
npx skills init my-skill
```

A skill is a directory with `SKILL.md` plus optional supporting files. Keep `SKILL.md` focused: name, description/trigger, and the exact procedure the agent should follow. Put large examples, templates, or scripts in sibling files and reference them from `SKILL.md`.
