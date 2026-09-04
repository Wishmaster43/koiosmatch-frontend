// Extracted from VacancySearchTab (SIZE-SPLIT-B): the shared pure formatter for
// summary-card and result-row range display — kept out of the component files
// so react-refresh only ever sees components there.

// Renders a min/max pair as a compact range string ("20–32", "≥ 20", "≤ 32"),
// or null when neither bound is present — the caller then omits the line entirely.
export function formatRange(min: number | null, max: number | null, format: (n: number) => string): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${format(min)}–${format(max)}`
  return format((min ?? max) as number)
}
