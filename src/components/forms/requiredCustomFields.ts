/**
 * requiredCustomFields — pure helpers shared by RequiredCustomFieldsCard and the
 * create-modal containers that render it (ONIX N-005). Split into its own module
 * (not re-exported alongside the component) so the component file stays
 * export-only-components for Fast Refresh (HUISSTIJL react-refresh rule).
 */
import type { CustomFieldDef } from '@/lib/useCustomFields'

// A def the backend actually treats as required today (ONIX contract note:
// Danny's always-required-only vs. required_for-too decision is pending —
// render both, since both are what the server currently refuses).
export const isRequiredCustomField = (f: CustomFieldDef): boolean =>
  f.required_always === true || (f.required_for?.length ?? 0) > 0

// The 422 bag keys a required-fields card renders — passed as `renderedKeys` to
// unmappedFormErrors so these never ALSO trigger the generic unmapped banner.
export function requiredCustomFieldKeys(fields: CustomFieldDef[]): string[] {
  return fields.map(f => `custom_fields.${f.key}`)
}

// A value counts as "filled" for a required custom field: a real boolean
// (false is a valid, filled answer) or a non-empty trimmed string/number.
export function isCustomFieldFilled(value: unknown): boolean {
  return typeof value === 'boolean' || (value !== undefined && value !== null && String(value).trim() !== '')
}

// The dotted-key error flags for every required def that is currently empty
// (e.g. { 'custom_fields.vog': true }), or null when all of them are filled —
// the one shared pre-check every create modal's submit guard runs before
// POSTing, so the client blocks the same thing the server would 422 on.
export function requiredCustomFieldErrors(requiredDefs: CustomFieldDef[], values: Record<string, unknown>): Record<string, boolean> | null {
  const errors: Record<string, boolean> = {}
  requiredDefs.forEach(def => { if (!isCustomFieldFilled(values[def.key])) errors[`custom_fields.${def.key}`] = true })
  return Object.keys(errors).length ? errors : null
}

// One shared "custom field changed" handler for the three customer sub-entity
// modals (location/department/contact): updates the field AND clears its own
// dotted 422 flag (`custom_fields.<key>`) so a fixed value stops showing the
// stale server message — mirrors the candidate modal's `setCustomField`.
export function makeCustomFieldChangeHandler(
  values: Record<string, unknown>,
  setValues: (v: Record<string, unknown>) => void,
  setErrors: (fn: (e: Record<string, boolean>) => Record<string, boolean>) => void,
): (key: string, value: unknown) => void {
  return (key, value) => {
    setValues({ ...values, [key]: value })
    setErrors(e => ({ ...e, [`custom_fields.${key}`]: false }))
  }
}
