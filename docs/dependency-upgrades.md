# Dependency upgrades

## Release cooldowns

Releases younger than 3 days are held back, by `minimumReleaseAge` in `pnpm-workspace.yaml` and `minimum_release_age` in `mise.toml`.

- A package needed sooner goes in `minimumReleaseAgeExclude`, with a comment saying when to drop it.
- A transitive pin that fixes a vulnerability goes in `overrides` in `pnpm-workspace.yaml`, with a comment naming the upstream release that makes it unnecessary.

## Upgrading

```bash
pnpm outdated     # frontend, from the repo root
pnpm up --latest  # commit package.json and pnpm-lock.yaml together

cargo update      # Rust, from src-tauri/ (in the toolbox on Fedora Atomic)

mise outdated     # tools
mise up --bump
```

For a new Rust major (or a new minor of a `0.x` crate), raise its version in the manifest.

## Keep together

Some packages are released together and must stay on the same version:

- `tract-onnx` and `tract-linalg`
- the `tauri` crates, `@tauri-apps/api` and the `@tauri-apps/plugin-*` packages

## New licences

`mise licenses:generate` fails when an upgrade brings in a crate whose licence is not `accepted` in `src-tauri/about.toml`. Check the licence before adding it.

## Verify

```bash
mise check
mise test
pnpm build
mise audit  # fails on high/critical advisories in production dependencies
```
