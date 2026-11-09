/** A word in the chosen script and, when both are shown, its traditional form after a divider. */
export function WordForms({ word, alternate }: { word: string; alternate: string | null }) {
  return (
    <>
      {word}
      {alternate && (
        <>
          <span aria-hidden className="mx-[0.25em] font-light text-muted-foreground">
            /
          </span>
          {alternate}
        </>
      )}
    </>
  );
}
