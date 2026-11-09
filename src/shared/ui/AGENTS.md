# AGENTS.md

- `shadcn/` is vendored shadcn (Base UI, never Radix) and read-only: never edit a file there, wrap it in a first-party component instead. Never refetch or `shadcn add --overwrite` one either, since it reverts earlier local fixes. Keep them even when an unused-code scan flags them. Lint, format, coverage and knip skip `shadcn/`
- Everything outside `shadcn/` is first-party: flat, or in `data-table/` or `charts/` when it belongs there. Component files are PascalCase with named exports
- Import by file (`@/shared/ui/shadcn/button.tsx`)
- Overlays (Apple and GNOME HIG): a routed page (`PageHeader onBack`, primary action in the header) for screens that manage one record's list; a `Sheet` for short create/edit forms and read-only details; a plain `Dialog` (`sm`/`md`) for options before one action. Only an AlertDialog may open over another overlay
- Use shadcn variants and sizes (`size="xs"`/`"sm"`, `variant="outline"`) before `className`; `className` is for layout, not restyling. A bare `DialogFooter` or `AlertDialogFooter` takes no padding: the content already pads it
- A surface on the page canvas is a `Card` (`size="sm"` for dense panels; tables via `DataTablePanel`), and an alert there is an `Alert`. An `overflow-*` container holding cards takes `-m-1 p-1`, or it clips their ring and shadow; in a scrolling flex column the cards need `shrink-0`, since `Card` is `overflow-hidden` and would shrink instead of scroll. Boxes inside a card, sheet or dialog are flat: `rounded-lg border`, no shadow
- `ConfirmationDialog` only for irreversible or far-reaching actions: `confirmLabel` repeats the title's verb ("Delete", "Activate"), the message names the item, `destructive` only when it destroys, `loading` while it runs. Reversible actions get an Undo toast instead
