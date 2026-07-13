// Shared workflow constants.

// The three operator groups the picker renders as <optgroup>s (Make-style,
// FILTER-VELD-1): text comparisons, numeric/clock ordering, date/time ordering.
export type OperatorGroup = 'text' | 'number' | 'date'

// Filter/condition operators — ONE source for the inline FiltersField (entity
// modules) and the edge-filter panel. VALUES are the backend FilterEvaluator
// keys (the old Dutch/symbol values '≠'/'bevat'/'is leeg' never matched a case
// server-side — the inline filter silently did nothing for them); labels render
// as the familiar symbol or through i18n (canvas.op* keys, all five locales).
export const OPERATOR_OPTIONS: Array<{ value: string; symbol?: string; labelKey?: string; group: OperatorGroup }> = [
  { value: '=', symbol: '=', group: 'text' },
  { value: '!=', symbol: '≠', group: 'text' },
  { value: 'contains', labelKey: 'canvas.opContains', group: 'text' },
  { value: 'not_contains', labelKey: 'canvas.opNotContains', group: 'text' },
  { value: 'empty', labelKey: 'canvas.opEmpty', group: 'text' },
  { value: 'not_empty', labelKey: 'canvas.opNotEmpty', group: 'text' },
  { value: 'in', labelKey: 'canvas.opIn', group: 'text' },
  { value: 'not_in', labelKey: 'canvas.opNotIn', group: 'text' },
  { value: '>', symbol: '>', group: 'number' },
  { value: '>=', symbol: '≥', group: 'number' },
  { value: '<', symbol: '<', group: 'number' },
  { value: '<=', symbol: '≤', group: 'number' },
  { value: 'date_gte', labelKey: 'canvas.opDateGte', group: 'date' },
  { value: 'date_gt', labelKey: 'canvas.opDateGt', group: 'date' },
  { value: 'date_lte', labelKey: 'canvas.opDateLte', group: 'date' },
  { value: 'date_lt', labelKey: 'canvas.opDateLt', group: 'date' },
]

// <optgroup> header i18n keys per operator group, in render order.
export const OPERATOR_GROUP_LABEL_KEYS: Record<OperatorGroup, string> = {
  text: 'canvas.opGroupText', number: 'canvas.opGroupNumber', date: 'canvas.opGroupDate',
}

// Operators that never need a value (backend reads presence/absence only).
export const VALUELESS_OPERATORS = ['empty', 'not_empty']

// Legacy persisted operator values (pre-2026-07-09 configs) → backend keys.
// They never functioned server-side, so normalising on read loses nothing.
export const LEGACY_OPERATOR_MAP: Record<string, string> = {
  '≠': '!=', '≥': '>=', '≤': '<=',
  'bevat': 'contains', 'bevat niet': 'not_contains',
  'is leeg': 'empty', 'is gevuld': 'not_empty',
}

// Normalise a stored operator to its backend key (pass-through when already valid).
export const normalizeOperator = (op?: string): string => LEGACY_OPERATOR_MAP[op ?? ''] ?? op ?? '='
