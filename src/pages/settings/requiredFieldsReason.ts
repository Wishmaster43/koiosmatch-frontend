/**
 * requiredFieldsReason — shared translation of the field-inventory's raw `reason`
 * string (VERPLICHTE-VELDEN-INVENTARIS-1) into an i18n key. Hoisted out of the
 * candidate catalogue (17-09 verifier fix) so the customer-family screens reuse the
 * exact same category map instead of a second hand-typed copy (§11) — the candidate
 * and the five other-entity inventories (App\Services\Fields\FieldInventory /
 * OtherEntityFieldInventory) draw their reason PROSE from the same small, closed
 * vocabulary (consent / financial / relation / webhook-stamped / custom-fields), plus
 * the customer-family-only "write-only pivot" relation text.
 */

// The exact measured backend reason strings mapped to their `settings.fieldInventory.reason.*` key.
const REASON_CATEGORY_BY_TEXT: Record<string, string> = {
  'relation — slice 2': 'relation',
  'consent — not requirable this round': 'consent',
  'financial data — a required IBAN would block every recruiter without the permission': 'financial',
  'webhook-stamped by the Facebook-lead job — no create input exists': 'webhookStamped',
  'custom fields carry their own required/required_phases mechanism on the field definition': 'customFields',
  // OtherEntityFieldInventory::NOT_READABLE_REASON — a write-only pivot-sync mutator
  // the guard can never read back (customer/customer_contact/customer_location).
  'relation — a write-only pivot-sync field the guard cannot read back, so requiring it would be a permanent 422': 'relation',
}

// The translated i18n key for a raw inventory reason, or null when the text is not one
// of the known categories (caller falls back to the raw string in that case).
export function reasonI18nKey(reason: string): string | null {
  const category = REASON_CATEGORY_BY_TEXT[reason]
  return category ? `settings.fieldInventory.reason.${category}` : null
}

/** One field-inventory row shaped for RequiredFieldsMatrixTable / FlatRequiredFieldsToggleList. */
export interface InventoryRow {
  key: string
  labelKey: string
  requirable: boolean
  reason: string | null
}

/** The minimal shape of a `useFieldInventory` field this helper needs. */
interface InventorySourceField {
  key: string
  requirable: boolean
  requires_permission: string | null
  reason: string | null
}

/**
 * Flip one field's required-membership for one phase inside a phase-keyed
 * `{ <phase>: [field_keys] }` map, stripping every currently-non-requirable key from
 * EVERY phase on the way out (§3 no fake affordance — a stale "required" key the admin
 * can no longer clear would otherwise ride along invisibly forever). Used by
 * CustomerPhaseRequiredFieldsMatrix; the candidate screen keeps its own toggle (its
 * config is keyed differently) and strips the same set on save.
 */
export function togglePhaseKeyedField(
  cfg: Record<string, string[]>,
  phase: string,
  field: string,
  nonRequirableKeys: Set<string>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  for (const [p, list] of Object.entries(cfg)) {
    next[p] = (list ?? []).filter(k => !nonRequirableKeys.has(k))
  }
  const current = next[phase] ?? []
  next[phase] = current.includes(field) ? current.filter(x => x !== field) : [...current, field]
  return next
}

/**
 * Build the row list both customer required-fields screens render (verifier fix 17-09,
 * extracted to close the DRY-ceiling clone between CustomerPhaseRequiredFieldsMatrix and
 * CustomerRequiredFieldsSettings): filters out fields the caller lacks permission for,
 * resolves the label through the given catalogue map (raw key as fallback), and
 * translates the raw English `reason` through `reasonI18nKey` (raw text as fallback for
 * an unrecognised reason).
 */
export function buildInventoryRows(
  fields: InventorySourceField[],
  labelKeys: Record<string, string>,
  hasPermission: (permission: string) => boolean,
  t: (key: string) => string,
): InventoryRow[] {
  return fields
    .filter(f => !f.requires_permission || hasPermission(f.requires_permission))
    .map(f => {
      const reasonKey = f.reason ? reasonI18nKey(f.reason) : null
      return {
        key: f.key,
        labelKey: labelKeys[f.key] ?? f.key,
        requirable: f.requirable,
        reason: f.reason ? (reasonKey ? t(reasonKey) : f.reason) : null,
      }
    })
}
