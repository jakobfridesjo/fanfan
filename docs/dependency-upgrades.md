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
- `solid-js` and `@solidjs/web`
- the `tauri` crates, `@tauri-apps/api` and the `@tauri-apps/plugin-*` packages

## Solid 2 prereleases

Solid 2 is stable, but some libraries support it only in a prerelease, pinned to an exact version in `package.json`: `@tanstack/solid-router` and its devtools (rc), `@tanstack/solid-query` and its devtools (rc), `@kobalte/core` (alpha). `pnpm up --latest` leaves a prerelease alone, or moves it to the last stable release, which is for Solid 1: raise each by hand (`pnpm view <package> dist-tags`), read its changelog, and move it to the stable release once there is one.

TanStack Table, Virtual, Pacer and Charts have no Solid 2 adapter yet, so the app binds their framework-free cores itself (`@tanstack/table-core` in `shared/lib/table.ts`, `@tanstack/virtual-core` in `shared/lib/use-virtual-rows.ts`, `@tanstack/pacer`, `@tanstack/charts` in `shared/ui/charts/Chart.tsx`). TanStack Form has none either; `shared/lib/form.ts` stands in for it. Replace each with the official adapter once it supports Solid 2.

`patches/@kobalte__core@2.0.0-alpha.5.patch` (applied by pnpm, listed under `patchedDependencies` in `pnpm-workspace.yaml`) makes Kobalte register each overlay in its layer stack once its element exists; without it no dialog, popover or drawer closes on Escape. `shared/ui/ConfirmationDialog.test.tsx` fails if a new Kobalte release still needs it; drop the patch when it passes without.

## New licences

`mise licenses:generate` fails when an upgrade brings in a crate whose licence is not `accepted` in `src-tauri/about.toml`. Check the licence before adding it.

## Verify

```bash
mise check
mise test
pnpm build
mise audit  # fails on high/critical advisories in production dependencies
```
