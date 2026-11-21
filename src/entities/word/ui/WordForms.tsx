import { Show } from "solid-js";

/** A word in the chosen script and, when both are shown, its traditional form after a divider. */
export function WordForms(props: { word: string; alternate: string | null }) {
  return (
    <>
      {props.word}
      <Show when={props.alternate}>
        <span aria-hidden="true" class="mx-[0.25em] font-light text-muted-foreground">
          /
        </span>
        {props.alternate}
      </Show>
    </>
  );
}
