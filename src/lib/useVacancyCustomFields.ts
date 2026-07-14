/**
 * useVacancyCustomFields — thin wrapper over the generic useCustomFields('vacancy')
 * (G-13 / AP-CO10). Kept as its own module so existing callers (ExtraTab, the
 * vacancy drawer) need no change; the fetch/cache/normalisation logic itself lives
 * in useCustomFields — one implementation, zero duplicated fetch logic (§0.4).
 */
import { useCustomFields } from './useCustomFields'

export interface VacancyFieldDef {
  id?: string | number
  key: string
  label: string
  label_i18n?: Record<string, string>
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'textarea'
  options?: string[]
  active: boolean
  has_data?: boolean
}

export function useVacancyCustomFields() {
  const { fields, allFields, loading, invalidate } = useCustomFields('vacancy')
  // VacancyFieldDef is the generic CustomFieldDef minus required_for/sort_order —
  // those extra fields are simply ignored by ExtraTab.
  return {
    fields: fields as unknown as VacancyFieldDef[],
    allFields: allFields as unknown as VacancyFieldDef[],
    loading, invalidate,
  }
}
