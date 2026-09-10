/**
 * reportWindowLabel (DRY round 11) — the report window caption seven pages
 * build the same way: two DD-MM-YYYY dates joined by an en dash. The dash here
 * is a DATA separator between two date values, not sentence punctuation (§5
 * allows it in that role). `from`/`to` stay page-supplied (rule B) — each
 * report reads its own window off a different envelope path (data.from/to,
 * data.period.from/to, data.meta.from/to).
 */
export function reportWindowLabel(
  formatDate: (value: string | undefined) => string,
  from: string | undefined,
  to: string | undefined,
): string {
  return `${formatDate(from)} – ${formatDate(to)}`
}
