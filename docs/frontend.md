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

## Solid

The frontend is [Solid](https://docs.solidjs.com/) 2. `node_modules/solid-js/CHEATSHEET.md` lists what differs from Solid 1; these are the habits this code keeps to:

- A component runs once. What changes is read where it is used: in JSX, a `createMemo`, or an effect's first function. Never destructure `props`.
- A `model/use-<x>.ts` hook returns an object of getters (`get current() { return current(); }`), so `deck.current` in JSX follows the deck; pass such objects on whole, and pass accessors (`() => value`) where a hook needs a value that changes.
- `createEffect(compute, apply)`: what `compute` reads decides when `apply` runs, and `apply` runs again whenever `compute` does, equal value or not. Read props and derived values through a `createMemo` there, or the effect repeats on every unrelated change. `apply` returns its cleanup. For work done once the component is on the page, `onSettled`.
- An element is kept with `ref={(element) => (box = element)}`; the short `ref={box}` hides the assignment from the linter.
- A list is a `<For>`; a part that must start afresh for each item (a swipe card per word, a page per book) is a keyed `<Show when={id} keyed>`.
- Solid Dev warns `STRICT_READ_UNTRACKED` in the console (and in test output) for a changing value read where it will not update. Fix the read; `untrack` only where once is meant.
- ARIA states are written `"true"` or `"false"` (`ariaBoolean` in `shared/lib/aria.ts`), attributes in lowercase (`maxlength`, `for`, `stroke-width`, `colspan`), and `class` takes a string, an array or an object.
- A text input keeps what is typed in the DOM: set its first value in `ref`, follow it with `onInput`, and write `value` again only when something else changes it (see `DebouncedSearchInput`).

## Calling Rust

- Every call goes through `commands` in `shared/api/commands.ts`. Never call `invoke` anywhere else.
- Show a failed command with `commandErrorMessage(error, fallback)`.
- Query options and keys live in `shared/api/queries.ts`. See [architecture.md](architecture.md#the-command-contract) for which settings belong in a key.
- Read a query with `useCommandQuery(() => options)` from the same file, not Solid Query's `useQuery`: its `data` is the plain value in the cache, undefined until fetched. `useQuery`'s own `data` holds its reader (and the page around it) back until the fetch lands, and is a store rather than the value Rust sent.
- `useMutation` takes a function returning its options.
- Word mutations call `invalidateStudyData`: a word's status changes every deck, every coverage figure and the review queue.

## Forms

- Use `useSchemaForm(schema, empty, onSubmit)` from `shared/lib/form.ts`: it validates the values against the schema as they change and hands `onSubmit` the parsed values. (TanStack Form has no Solid 2 adapter yet; move back to it once it has.)
- Render text fields with `TextField` from `shared/ui/FormFields.tsx`, given `form.field("name")`. Add other field components there when a form needs them.
- Show errors inline, after blur or submit. Never as toasts.
- Use `zod/mini` only. Wrap, don't chain: `z.optional(x)`, `z.extend`, `x.check(...)`.

## Text and settings

- **UI text** lives in `shared/i18n/messages-{en,sv,zh}.ts`. Never hard-code a user-facing string.
  - English defines the `Messages` type; the others must match it.
  - Read it with `useMessages()`, whose sections follow the language where they are read (`m.common.back` in JSX), or `currentMessages()` outside a component (e.g. zod `error: () => ...`).
- **Numbers and dates** follow the language through `appLocale()`.
- **Chinese text** gets `lang="zh"`, so the webview picks a Chinese font.
- **Settings** are persisted atoms (`shared/lib/atom.ts`) in `shared/config/preferences.ts`. An atom is a signal: a component reads it by calling it (`scriptAtom()`) in JSX, a memo or an effect. A signal shows a write only after Solid's next flush, so code outside the components, which reads what it has just written, uses `get`, `set` and `subscribe`.

## UI components

### Primitives

`shared/ui/shadcn/` holds the primitives, in shadcn's look and naming: buttons, cards, inputs, tables, and those that need behaviour (dialog, drawer, popover, select, calendar, tooltip, menu, progress, collapsible, toggle group) on [Kobalte](https://kobalte.dev/), toasts on `solid-sonner`.

- They are written by hand: shadcn has no Solid components, so never run `shadcn add`. The `scroll-fade` utility is copied from shadcn's stylesheet into `app/styles/shadcn/`.
- Each takes only what the app uses. Add a part, or a new primitive, when something needs it; knip deletes what nothing imports.
- Kobalte marks state with `data-expanded`, `data-closed`, `data-highlighted`, `data-selected`, `data-pressed`, `data-disabled` and `data-orientation`.
- A primitive that renders as another component takes `as`: `<TooltipTrigger as={Button} variant="ghost">`.

### Other components

Everything in `shared/ui/` outside `shadcn/`: flat, or in `data-table/` or `charts/`, as PascalCase files with named exports. Icons are Lucide's, drawn with `Icon` (`shared/ui/Icon.tsx`) from the `lucide` package: `<Icon icon={ArrowLeft} />`.

- `DataTable` takes a table from `useDataTable` (`shared/lib/table.ts`, a Solid binding over `@tanstack/table-core`); its `data` and `state` options are getters over signals. `useVirtualRows` (over `@tanstack/virtual-core`) renders only the rows in view.
- `Chart` (`shared/ui/charts/Chart.tsx`) hosts a TanStack Charts definition; build the definition in a `createMemo`.

### Styling

- Reach for shadcn variants and sizes (`size="xs"`, `size="sm"`, `variant="outline"`) before `class`.
- `class` is for layout, not restyling.

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
