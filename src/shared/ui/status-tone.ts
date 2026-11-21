export const STATUS_TONE_CLASSNAMES = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted/60 text-muted-foreground",
} as const;

export type StatusTone = keyof typeof STATUS_TONE_CLASSNAMES;
