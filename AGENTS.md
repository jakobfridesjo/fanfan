# AGENTS.md

翻翻 FanFan: a Tauri 2 app (React in `src/`, Rust in `src-tauri/`) that turns a Chinese book into a vocabulary deck, a reader and FSRS reviews. See [README.md](README.md).

- Run everything as mise tasks from the repo root; verify with `mise check` and `mise test`
- On a Fedora Atomic Desktop host, all Rust builds only inside the `fedora-toolbox-45` toolbox
- Logic lives in `src-tauri/vocab-core/`; the frontend reaches Rust only through `src/shared/api/commands.ts`, whose types mirror the serde types by hand
- Never hard-code user-facing strings; never edit `src/shared/ui/shadcn/` or `routeTree.gen.ts`
- Clear code beats comments
- Edit only `AGENTS.md`; `CLAUDE.md` is a symlink to it. Documentation lives in `docs/`; keep it in sync when the code it describes changes

Read the doc for the area you touch:

- [docs/architecture.md](docs/architecture.md): layout, the command contract, data, models
- [docs/frontend.md](docs/frontend.md): FSD structure, commands and queries, forms, i18n, UI components
- [docs/testing.md](docs/testing.md): Rust and frontend tests, mocking Rust
- [docs/building.md](docs/building.md): system packages, desktop, Android, macOS
- [docs/licences.md](docs/licences.md): data and model sources, licence checks
- [docs/dependency-upgrades.md](docs/dependency-upgrades.md): pnpm, Cargo and mise upgrades
- [docs/skills.md](docs/skills.md): agent skills
