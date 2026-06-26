/**
 * initialsOf — one shared source for avatar/monogram initials across the app.
 * Takes the first letter of the first two words, uppercased. `fallback` is
 * returned for a blank/empty name (default '?'; e.g. 'T' for tasks, '' for none).
 */
export const initialsOf = (name?: string | null, fallback = '?'): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]).join('').toUpperCase() || fallback
}
