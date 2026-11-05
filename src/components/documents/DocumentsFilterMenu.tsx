// The compact "Filter" menu of a documents list (candidate, customer, vacancy): the shared DrawerFilterMenu
// with the common filter labels baked in, so the three lists carry one wiring instead of three copies.
import { useTranslation } from 'react-i18next'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'

interface DocumentsFilterMenuProps {
  filters: DrawerFilterConfig[]
}

// Self-hides when the tenant has no document types (DrawerFilterMenu renders null on an empty config).
export default function DocumentsFilterMenu({ filters }: DocumentsFilterMenuProps) {
  // Namespaced keys (common:…) resolve from any bound namespace, exactly as the three callers wrote them.
  const { t } = useTranslation()
  return <DrawerFilterMenu filters={filters} label={t('common:filters.button')} title={t('common:filters.title')} clearAllLabel={t('common:filters.clearAll')} />
}
