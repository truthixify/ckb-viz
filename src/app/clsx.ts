type ClassValue = string | number | false | null | undefined

/** Minimal classnames joiner — no dependency for a one-line need. */
export function clsx(...values: ClassValue[]): string {
  return values.filter((v): v is string | number => Boolean(v)).join(' ')
}
