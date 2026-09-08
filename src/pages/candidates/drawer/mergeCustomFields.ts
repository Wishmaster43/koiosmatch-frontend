/**
 * mergeCustomFields — pure rules behind the merge modal's custom-field step (X-37,
 * Danny K-27: never auto-merge two DIFFERENT custom-field values, the user chooses per
 * field). Which tenant custom fields collide between the two records, and what the
 * survivor's custom_fields map becomes once every collision has a choice. Kept out of
 * the modal so the rules are unit-tested without rendering (§3: logic outside JSX).
 */
export type CustomFieldMap = Record<string, unknown>
export type ConflictChoice = 'survivor' | 'source'

// null / undefined / '' mean "no value"; false and 0 are real values (boolean and
// number fields), so a `false` on one side and `true` on the other IS a collision.
export const isEmptyCustomValue = (v: unknown): boolean => v == null || v === ''

// Key-order-independent equality for the JSON-ish values custom fields hold.
const stableJson = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val))
    ? Object.fromEntries(Object.keys(val as object).sort().map(k => [k, (val as Record<string, unknown>)[k]]))
    : val)

// The keys where BOTH records hold a value and those values differ — the only case a
// human must decide. A value on one side only is absorbed silently (no conflict).
export function computeCustomFieldConflicts(survivor: CustomFieldMap, source: CustomFieldMap): string[] {
  return Object.keys(source).filter(key =>
    !isEmptyCustomValue(source[key]) && !isEmptyCustomValue(survivor[key])
    && stableJson(survivor[key]) !== stableJson(source[key]))
}

// The survivor's map after the merge: its own values, the source's values where the
// survivor had none (the modal's warning promises "the source's data is absorbed"),
// and the chosen side per collision — an unknown choice keeps the survivor's value.
export function mergeCustomFieldMaps(survivor: CustomFieldMap, source: CustomFieldMap, choices: Record<string, ConflictChoice>): CustomFieldMap {
  const merged: CustomFieldMap = { ...survivor }
  for (const key of Object.keys(source)) {
    if (isEmptyCustomValue(source[key])) continue
    if (isEmptyCustomValue(merged[key]) || choices[key] === 'source') merged[key] = source[key]
  }
  return merged
}

// True when the merge would change the survivor's map at all; when it would not, the
// merge request stays the exact pre-X-37 `{ source_id }` body (no field_choices).
export const customFieldsChanged = (before: CustomFieldMap, after: CustomFieldMap): boolean =>
  stableJson(before) !== stableJson(after)
