/** A boolean as ARIA writes it: `aria-pressed` and its kin take "true" or "false", never a bare attribute. */
export const ariaBoolean = (value: boolean | undefined) => (value ? "true" : "false");
