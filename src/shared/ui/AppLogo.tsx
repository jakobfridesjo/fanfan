/** The app mark, drawn inline so it takes the accent colour of the chosen background. */
export function AppLogo(props: { class?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" role="img" aria-label="Logo" class={props.class}>
      <rect width="32" height="32" rx="8" class="fill-primary" />
      <path
        d="M10 22V10h12"
        class="stroke-primary-foreground"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="20" cy="20" r="3" class="fill-primary-foreground" />
    </svg>
  );
}
