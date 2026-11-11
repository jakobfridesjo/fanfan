# Frontend

## Structure

The frontend follows [Feature-Sliced Design](https://feature-sliced.design/) v2.1. `mise fsd` checks it.

```
app → pages → features → entities → shared
```

- Import only from lower layers.
- Never import sideways between slices.
- `shared/` has no slices.
- No barrel files: import the concrete file via `@/`, with its extension.

```ts
import { useDeckManager } from "@/pages/deck/model/use-deck-manager.ts";
```

### Naming

| Kind      | Style                             | Example                |
| --------- | --------------------------------- | ---------------------- |
| Module    | kebab-case                        | `use-deck-manager.ts`  |
| Component | PascalCase                        | `DeckManager.tsx`      |
| Route     | TanStack Router, in `app/routes/` | `_app/known-words.tsx` |

`_app/` is the pathless sidebar shell. Never edit `routeTree.gen.ts`.

### Page slices

- State and mutations: `model/use-<x>-manager.ts`
- Rendering only: `ui/<X>Manager.tsx`

`pages/deck` is the reference slice.

## Calling Rust

- Every call goes through `commands` in `shared/api/commands.ts`. Never call `invoke` anywhere else.
- Show a failed command with `commandErrorMessage(error, fallback)`.
- Query options and keys live in `shared/api/queries.ts`. See [architecture.md](architecture.md#the-command-contract) for which settings belong in a key.
- Word mutations call `invalidateStudyData`: a word's status changes every deck, every coverage figure and the review queue.

## Forms

- Use TanStack Form through `shared/lib/form.ts`: `useAppForm` with `schemaFormOptions(schema, empty)`, submitting from `validatorOutputs[0]`.
- Render text fields with `field.TextField` from `shared/ui/FormFields.tsx`. Add other field components there when a form needs them.
- Show errors inline, after blur or submit. Never as toasts.
- Use `zod/mini` only. Wrap, don't chain: `z.optional(x)`, `z.extend`, `x.check(...)`.

## Text and settings

- **UI text** lives in `shared/i18n/messages-{en,sv,zh}.ts`. Never hard-code a user-facing string.
  - English defines the `Messages` type; the others must match it.
  - Read it with `useMessages()`, or `currentMessages()` outside a render (e.g. zod `error: () => ...`).
- **Numbers and dates** follow the language through `appLocale()`.
- **Chinese text** gets `lang="zh"`, so the webview picks a Chinese font.
- **Settings** are persisted atoms in `shared/config/preferences.ts`, read with `useSelector`.

## UI components

### Vendored shadcn

`shared/ui/shadcn/` is vendored shadcn, built on Base UI (never Radix).

- **Read-only.** Never edit a file there; wrap it in a first-party component instead.
- **Never refetch** a component or run `shadcn add --overwrite`: it reverts earlier local fixes.
- **Delete** a component once nothing imports it.
- Lint, format, coverage and knip skip it. Anything else knip reports as unused gets deleted.

### First-party components

Everything in `shared/ui/` outside `shadcn/`: flat, or in `data-table/` or `charts/`, as PascalCase files with named exports.

### Styling

- Reach for shadcn variants and sizes (`size="xs"`, `size="sm"`, `variant="outline"`) before `className`.
- `className` is for layout, not restyling.

### Surfaces

| On the page canvas | Use                                         |
| ------------------ | ------------------------------------------- |
| A panel            | `Card` (`size="sm"` when dense)             |
| A table            | `DataTable`, straight on the page, no frame |
| An alert           | `Alert`                                     |

- Inside a card or dialog, boxes are flat: `rounded-lg border`, no shadow.
- An `overflow-*` container holding cards needs `-m-1 p-1`, or it clips their ring and shadow.
- Cards in a scrolling flex column need `shrink-0`. `Card` is `overflow-hidden`, so it would shrink instead of scroll.

### Overlays

Follow the Apple and GNOME HIG:

| Situation                    | Use                                                              |
| ---------------------------- | ---------------------------------------------------------------- |
| Managing one record's list   | A routed page: `PageHeader onBack`, primary action in the header |
| Options before one action    | A plain `Dialog`, `sm` or `md`                                   |
| Opening over another overlay | Only an `AlertDialog`                                            |

Dialog footers:

- A bare `DialogFooter` or `AlertDialogFooter` takes no padding: the content already pads it.
- With two buttons, give it `grid grid-cols-2 sm:flex`, Cancel first, so the buttons sit side by side on a phone.

### Confirmations

Use `ConfirmationDialog` only for irreversible or far-reaching actions. Reversible actions get an Undo toast instead.

- `confirmLabel` repeats the title's verb ("Delete", "Activate").
- The message names the item.
- `destructive` only when it destroys something.
- `loading` while the action runs.
