# Dependency upgrade guide

The frontend uses **pnpm** (`package.json` and `pnpm-lock.yaml`). The Rust side uses **Cargo** (`src-tauri/Cargo.toml`, `src-tauri/vocab-core/Cargo.toml` and one `src-tauri/Cargo.lock` for both). Tool versions (Node, pnpm, hk, pkl) are pinned in `mise.toml` and locked in `mise.lock`.

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

## Rust: Cargo

Run Cargo from `src-tauri/`; on a Fedora Atomic Desktop host, inside the `fedora-toolbox-45` toolbox.

```bash
cargo update               # every crate, within the ranges in the manifests
cargo update -p tract-onnx # one crate and what it needs
```

For a new major (or a new minor of a `0.x` crate), raise its version in the manifest, then build. Keep crates released together on the same version: `tract-onnx` and `tract-linalg`, and the `tauri` crates with `@tauri-apps/api` and the `@tauri-apps/plugin-*` packages.

`mise licenses:generate` fails when an upgrade brings in a crate under a licence not yet `accepted` in `src-tauri/about.toml`: check that licence before adding it.

## Tools: mise

```bash
mise outdated     # tools with newer versions
mise up --bump    # bump the versions in mise.toml and refresh mise.lock
```

## Verification checklist

After dependency upgrades, run the relevant checks from the repo root:

```bash
mise check  # lint, format, and typecheck checks
mise test   # Rust core tests, then frontend tests
mise build  # frontend build
mise audit  # frontend dependency audit
```

## References

- Cargo: [`cargo update`](https://doc.rust-lang.org/cargo/commands/cargo-update.html)
- pnpm: [`pnpm update`](https://pnpm.io/cli/update), [`pnpm outdated`](https://pnpm.io/cli/outdated)
