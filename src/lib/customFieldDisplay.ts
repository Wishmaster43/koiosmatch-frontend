/**
 * displayCustomFieldValue — the ONE read-only rendering of a tenant custom-field value
 * (boolean → yes/no, date → the house DD-MM-YYYY, empty → a dash, else the string).
 * Shared by the Extra tab (components/drawer/CustomFieldsTab) and the merge modal's
 * conflict step (X-37), so a raw ISO date or a bare `true` never reaches a screen twice
 * (DATUM-1). Lives next to lib/useCustomFields, which owns the definition shape.
 */
import type { CustomFieldDef } from '@/lib/useCustomFields'

// Render one value read-only; `t` resolves the common yes/no keys, `formatDate` is the
// house date formatter (useDateFormat().formatDate) — both injected so this stays pure.
export function displayCustomFieldValue(def: CustomFieldDef, raw: unknown, t: (k: string) => string, formatDate: (v: string) => string): string {
  if (raw == null || raw === '') return '—'
  if (def.type === 'boolean') return raw ? t('yes') : t('no')
  if (def.type === 'date' && typeof raw === 'string') return formatDate(raw)
  return String(raw)
}
