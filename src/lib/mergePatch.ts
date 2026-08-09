/**
 * mergePatch — deep merge a partial API/UI patch into an existing record. Every
 * entity page's optimistic single-record update (candidates/customers/vacancies/
 * matches/tasks) used to do a SHALLOW `{ ...record, ...patch }` — that REPLACES a
 * nested object wholesale, so a patch touching only one nested block (e.g. the
 * candidate drawer's ZZP tab: Facturatie's save sends `{ zzp: { iban, ... } }` —
 * only that block's keys) wiped the record's other nested keys (Bedrijf/Adres)
 * from the local view until the drawer was reopened and refetched (ZZP-MERGE-1,
 * measured live against PATCH /candidates/{id}: the server itself preserves the
 * untouched keys — only the optimistic local merge was lossy).
 *
 * Rules:
 * - a nested PLAIN OBJECT patch value merges key-by-key into the existing nested
 *   object (recursively) — the untouched sibling keys survive;
 * - an ARRAY patch value always REPLACES wholesale — a tag list shrinking from
 *   three to two must actually shrink, never "merge back" to three;
 * - an explicit `null` patch value always CLEARS the field — never silently
 *   skipped or merged away.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)

export function mergePatch<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(patch)) {
    const patchValue = patch[key]
    const baseValue = out[key]
    if (patchValue === null) {
      // Explicit null = "clear this field" — never skipped, never merged.
      out[key] = null
    } else if (Array.isArray(patchValue)) {
      // Arrays always replace wholesale, never merge element-by-element.
      out[key] = patchValue
    } else if (isPlainObject(patchValue) && isPlainObject(baseValue)) {
      // Both sides are plain objects: merge recursively so untouched sibling
      // keys of the nested block survive (the ZZP-MERGE-1 bug).
      out[key] = mergePatch(baseValue, patchValue)
    } else {
      out[key] = patchValue
    }
  }
  return out as T
}
