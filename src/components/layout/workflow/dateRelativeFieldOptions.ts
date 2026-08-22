/**
 * dateRelativeFieldOptions — the "date_relative" trigger's date-field whitelist
 * and its label resolver, extracted from DateRelativeFields.tsx (22-08) so the
 * component file exports only its component (react-refresh rule; §3: logic
 * lives beside the JSX, never inside it).
 */

// Backend whitelist (trigger_config.date_field) — never invent a third value here
// without a matching backend contract entry.
export const DATE_RELATIVE_FIELDS = [
  { value: 'available_again_date', labelKey: 'dateRelative.fieldAvailableAgain' },
  { value: 'match.end_date',       labelKey: 'dateRelative.fieldMatchEnd' },
] as const

export type DateRelativeFieldValue = typeof DATE_RELATIVE_FIELDS[number]['value']

// Resolves the translated label for a stored date_field value; an unknown or
// legacy value falls back to the raw value (or a dash) so it renders honestly.
export function dateRelativeFieldLabel(t: (k: string) => string, value?: string | null) {
  const entry = DATE_RELATIVE_FIELDS.find(f => f.value === value)
  return entry ? t(entry.labelKey) : (value ?? '—')
}
