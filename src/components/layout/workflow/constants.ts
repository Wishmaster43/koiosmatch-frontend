// Shared workflow constants.

// Filter/condition operators — ONE source for the inline FiltersField (entity
// modules) and the edge-filter panel. VALUES are the backend FilterEvaluator
// keys (the old Dutch/symbol values '≠'/'bevat'/'is leeg' never matched a case
// server-side — the inline filter silently did nothing for them); labels render
// as the familiar symbol or through i18n (canvas.op* keys, all five locales).
export const OPERATOR_OPTIONS: Array<{ value: string; symbol?: string; labelKey?: string }> = [
  { value: '=', symbol: '=' },
  { value: '!=', symbol: '≠' },
  { value: '>', symbol: '>' },
  { value: '>=', symbol: '≥' },
  { value: '<', symbol: '<' },
  { value: '<=', symbol: '≤' },
  { value: 'contains', labelKey: 'canvas.opContains' },
  { value: 'not_contains', labelKey: 'canvas.opNotContains' },
  { value: 'empty', labelKey: 'canvas.opEmpty' },
  { value: 'not_empty', labelKey: 'canvas.opNotEmpty' },
  { value: 'date_gte', labelKey: 'canvas.opDateGte' },
  { value: 'date_gt', labelKey: 'canvas.opDateGt' },
  { value: 'date_lte', labelKey: 'canvas.opDateLte' },
  { value: 'date_lt', labelKey: 'canvas.opDateLt' },
]

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
