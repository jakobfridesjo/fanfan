# 翻翻 FanFan

A Tauri 2 app for desktop and Android that teaches a Chinese book's vocabulary before and while you read it. Import a `.txt`, `.epub` or `.pdf`; its words come as a frequency-ranked swipe deck (right: known, left: learn), the reader colours each word by status, and learned words come back for review on an FSRS schedule. Speech and Chinese-to-English translation run offline.

## Quick start

Install the [system packages](docs/building.md#system-packages) first, then:

```bash
mise install  # tools
mise setup    # dependencies, CC-CEDICT, git hooks, test browser
mise desktop  # run the app with hot reload
mise check    # lint, format, typecheck, knip, steiger
mise test     # Rust core, then frontend
```

## Docs

- [Architecture](docs/architecture.md)
- [Frontend conventions](docs/frontend.md)
- [Testing](docs/testing.md)
- [Building for desktop, Android and macOS](docs/building.md)
- [Licences and data sources](docs/licences.md)
- [Dependency upgrades](docs/dependency-upgrades.md)
- [Agent skills](docs/skills.md)

## Licence

FanFan is licensed under either of [Apache License 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT), at your option. Unless you state otherwise, any contribution you submit for inclusion is dual-licensed the same way, without additional terms. Bundled data and models have their own licences: see [docs/licences.md](docs/licences.md).
