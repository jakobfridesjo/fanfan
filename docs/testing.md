# Testing

`mise test` runs both sides; `mise test:rust` and `mise test:web` run one.

## Rust

On a Fedora Atomic Desktop host, run Rust tests in the toolbox (see [building.md](building.md)).

`speaks_simplified_and_traditional_words` and `translates_simplified_and_traditional_sentences` need the real models, so they are `#[ignore]`d. The first run downloads the models into `src-tauri/target/models`:

```bash
cargo test --release -p vocab-core -- --ignored
```

## Frontend

### Where tests run

| File                              | Runs in                       |
| --------------------------------- | ----------------------------- |
| `*.test.ts`                       | Node                          |
| `*.test.tsx`, `*.browser.test.ts` | Chromium                      |
| `*.isolated.test.tsx`             | Chromium, for files that mock |

- Browser tests use Vitest Browser Mode; there is no jsdom.
- All browser tests share one page. Reset global stores in `app/testing/browser-shared-page.ts`.
- Install Chromium with `mise test:web:browsers` (add `--with-deps` on a fresh Linux).

### Mocking Rust

- Mock at the IPC boundary with `mockCommands` (`shared/test/tauri.ts`). Never `vi.mock` `commands.ts`.
- Push `Channel` messages with `sendToChannel`; check what was sent with `callsTo`.
- Build results with `shared/test/fixtures.ts` (`makeCard`, `makeDeck`, ...), overriding only the fields the test reads.
- A handler that keeps state (say, a `Map` of statuses) beats scripting each refetch.

### Other mocks

- Prefer the DOM, `renderPageInRouter`/`renderRoute` and props over `vi.mock()`.
- When you must mock, target a concrete module and name the file `*.isolated.test.tsx`.
