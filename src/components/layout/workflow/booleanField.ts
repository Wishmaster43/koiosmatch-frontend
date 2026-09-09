/**
 * booleanField — which workflow filter fields are yes/no, and how a stored boolean maps
 * onto the yes/no menu. Shared by the edge-filter panel (router lines) and the module
 * filters field (Danny 09-09: "filters moeten er zijn in de modules en op de lijntjes").
 * The module catalogue carries labels only, so the key names decide (consent flags,
 * is_/has_ predicates, enabled/active switches) until the catalogue publishes a type per
 * field (asked of CMBE with WORKFLOW-CONSENT-1).
 */
const BOOLEAN_FIELD = /(^|\.)(is_|has_)[a-z0-9_]+$|_(consent|enabled|active|opt_in)$/

// True when the field key names a yes/no value.
export function isBooleanField(field?: string): boolean {
  return !!field && BOOLEAN_FIELD.test(field.trim().toLowerCase())
}

// The stored value as the yes/no menu's option key ('' when nothing chosen yet).
export function booleanValueKey(value: string | boolean | undefined): string {
  if (value === true || value === 'true') return 'true'
  if (value === false || value === 'false') return 'false'
  return ''
}

// The text a plain input shows for a condition value (a stray boolean renders as its word).
export function textValue(value: string | boolean | undefined): string {
  return typeof value === 'boolean' ? String(value) : (value ?? '')
}
