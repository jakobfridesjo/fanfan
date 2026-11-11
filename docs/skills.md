# Agent skills

Skills live in `.agents/skills/` (gitignored; `.claude/skills` links to it). There are three kinds:

| Kind      | Example                         | Tracked by                                 |
| --------- | ------------------------------- | ------------------------------------------ |
| Installed | most skills                     | `skills-lock.json`                         |
| Tool      | hk's `hk-configure`, `hk-debug` | `mise.lock` (linked by `mise skills sync`) |
| Repo      | `update-docs`                   | git, added with `git add -f`               |

## Tasks

- `mise skills:install` restores missing installed skills and links tool skills. `mise setup` runs it whenever `skills-lock.json` or `mise.lock` changes. It never touches a skill that is already installed, even an outdated one.
- `mise skills:update` reinstalls every installed skill from upstream and rewrites `skills-lock.json`. The lock records no commit, so this takes whatever upstream has now: review the diff before committing.

To find, add or remove skills, use `pnpx skills` (see [skills.sh](https://skills.sh/)).
