/** The app mark, drawn inline so it takes the accent colour of the chosen background. */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" role="img" aria-label="Logo" className={className}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M10 22V10h12"
        className="stroke-primary-foreground"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="3" className="fill-primary-foreground" />
    </svg>
  );
}
