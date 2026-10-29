/**
 * windowUnitOptions — shared building block for O23 UNIT-NAAST-BEDRAG-1: the unit
 * picker that renders inline right of a time-window amount field (days/workdays/
 * weeks/months), instead of as its own catalogue row. One place builds the field
 * so every schema adopts the same shape instead of four hand copies.
 */
import type { SchemaField } from './SchemaSection'

// The four window units these amount fields offer (the "hours" option belongs only
// to the conversation-unanswered row, which is out of this batch's eleven pairs).
export const WINDOW_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'days', label: 'settings.options.window_unit.days' },
  { value: 'workdays', label: 'settings.options.window_unit.workdays' },
  { value: 'weeks', label: 'settings.options.window_unit.weeks' },
  { value: 'months', label: 'settings.options.window_unit.months' },
]

// Largest amount the UI accepts per unit, so a unit switch can never widen a window past
// roughly a year (BE WindowUnit::MAX_AMOUNT is looser; the UI stays on the stricter side).
export const WINDOW_UNIT_MAX_AMOUNT: Record<string, number> = { days: 365, workdays: 260, weeks: 52, months: 12 }

// Builds the ready `<amountKey>_unit` select field for a schema, so it can sit right
// after its amount field: `unitOf` marks it as a companion (SchemaSection renders it
// inline instead of as its own row) rather than a plain catalogue field. `defaultUnit`
// mirrors the BE catalogue row's default (CatalogRows): most windows default to days,
// but the weeks/workdays/months amounts default to their own unit.
export function unitFieldFor(amountKey: string, section: string, defaultUnit = 'days'): SchemaField {
  return {
    key: `${amountKey}_unit`,
    type: 'select',
    unitOf: amountKey,
    default: defaultUnit,
    options: WINDOW_UNIT_OPTIONS,
    labelKey: `settings.${section}.${amountKey}_unit.label`,
  }
}
