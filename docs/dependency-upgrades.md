# Dependency upgrade guide

The frontend uses **pnpm** (`package.json` and `pnpm-lock.yaml`). Tool versions (Node, pnpm, hk, pkl) are pinned in `mise.toml` and locked in `mise.lock`.

## Release cooldowns

Every manager holds back releases younger than 3 days:

- pnpm: `minimumReleaseAge: 4320` in `pnpm-workspace.yaml`. A package that must be installed sooner goes in `minimumReleaseAgeExclude`, with a comment saying when to drop it.
- mise: `minimum_release_age = "3d"` in `mise.toml`, with tool versions locked in `mise.lock`.

Transitive pins that fix a vulnerability go in `overrides` in `pnpm-workspace.yaml`, with a comment naming the upstream release that makes them unnecessary.

## Frontend: pnpm

Run pnpm commands from the repo root.

### Inspect outdated packages

```bash
pnpm outdated
```

### Update within existing `package.json` ranges

```bash
pnpm up
```

`pnpm update` aliases include `pnpm up` and `pnpm upgrade`. The default updates dependencies to the latest versions allowed by the current semver ranges.

### Update to latest versions, including new majors

```bash
# All frontend dependencies; may rewrite ranges in package.json
pnpm up --latest

# One dependency
pnpm up vite@latest
```

Useful options:

- `--interactive` / `-i` — choose upgrades interactively.
- `--latest` / `-L` — upgrade to the registry `latest` tag, even across current ranges.
- `--prod` / `-P` — only production and optional dependencies.
- `--dev` / `-D` — only dev dependencies.

After upgrading, commit changed `package.json` and `pnpm-lock.yaml` together.

## Tools: mise

```bash
mise outdated     # tools with newer versions
mise up --bump    # bump the versions in mise.toml and refresh mise.lock
```

## Verification checklist

After dependency upgrades, run the relevant checks from the repo root:

```bash
mise check  # lint, format, and typecheck checks
mise test   # frontend tests
mise build  # frontend build
mise audit  # dependency audit
```

## References

- pnpm: [`pnpm update`](https://pnpm.io/cli/update), [`pnpm outdated`](https://pnpm.io/cli/outdated)
