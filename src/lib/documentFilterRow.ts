import type { TFunction } from 'i18next'
import type { LookupOption } from '@/types/common'
import type { DrawerFilterConfig } from '@/components/drawer/drawerFilterTypes'

// DOC-FILTER-PARITY-1: the type filter row, behind the shared DrawerFilterMenu —
// self-hides when the tenant has no document types configured for this scope
// (DrawerFilterMenu renders null on empty). Shared by customers/vacancies
// document tabs (identical row shape); the caller's own t() supplies the
// translated strings, so the helper carries no i18n dependency of its own.
export function docTypeFilterRow(
  t: TFunction,
  docTypes: LookupOption[],
  value: string,
  onChange: (next: string) => void,
  docTypeLabel: (value: string) => string,
): DrawerFilterConfig[] {
  return docTypes.length > 0 ? [{
    type: 'single', key: 'docType', label: t('documents.type'), value, onChange,
    allLabel: t('documents.allTypes'),
    options: docTypes.map(dt => ({ value: String(dt.value ?? ''), label: docTypeLabel(String(dt.value ?? '')) })),
  }] : []
}
