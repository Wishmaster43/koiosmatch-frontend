/**
 * filterCategoryLabels — the shared "General/Organisation/Display" category
 * label triplet used by every entity's filter-group builder (§3A: the panel
 * feels identical entity-to-entity). Hand-copied identically across customers/
 * vacancies before this consolidation.
 */
import type { TFunction } from 'i18next'

// Getters (not eager values): a caller destructuring only catOrg/catDisplay
// never triggers the `general` lookup, so a namespace without that key
// (e.g. applications) is not silently asked for a missing i18n key.
export function filterCategoryLabels(t: TFunction) {
  return {
    get catGeneral() { return t('filters.categories.general') },
    get catOrg() { return t('filters.categories.organisation') },
    get catDisplay() { return t('filters.categories.display') },
  }
}
