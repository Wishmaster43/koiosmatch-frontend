/**
 * useCandidateCustomFields — thin wrapper over the generic useCustomFields('candidate')
 * (G-13 / AP-CO10). Kept as its own module so existing callers (CustomFieldsSection,
 * the candidate drawer) need no change; the fetch/cache/normalisation logic itself
 * lives in useCustomFields — one implementation, zero duplicated fetch logic (§0.4).
 */
import { useCustomFields } from './useCustomFields'
import type { CandidateCustomFieldDef } from '@/types/candidate'

export function useCandidateCustomFields() {
  const { fields, allFields, loading, invalidate } = useCustomFields('candidate')
  // CandidateCustomFieldDef and the generic CustomFieldDef share the identical
  // shape (id/key/label/label_i18n/type/options/required_for/sort_order/active/has_data).
  return {
    fields: fields as unknown as CandidateCustomFieldDef[],
    allFields: allFields as unknown as CandidateCustomFieldDef[],
    loading, invalidate,
  }
}
