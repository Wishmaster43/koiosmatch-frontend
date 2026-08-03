/**
 * ScopedVacanciesTab — the department/location "Vacatures" sub-tab
 * (SCOPED-LIST-TAB-1). Thin adapter over the shared ScopedListTab: picks the
 * right scope param (`customer_department_id` / `customer_location_id`) and
 * reuses the customer-level VacanciesTab's own row mapper + column shape
 * (title link, status pill, applications count) — never a forked copy.
 */
import { useTranslation } from 'react-i18next'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import { useNavigation } from '@/context/NavigationContext'
import ScopedListTab from './ScopedListTab'
import { mapVacancyRow } from '../hooks/useCustomerDrawerData'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'
import type { Column } from '@/components/ui/DataTable'

export default function ScopedVacanciesTab({ scope, id }: { scope: 'department' | 'location'; id: Id | undefined }) {
  const { t } = useTranslation('customers')
  const { openEntity } = useNavigation()
  const paramName = scope === 'department' ? 'customer_department_id' : 'customer_location_id'

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title,
      render: v => <EntityLink page="vacancies" id={v.id}>{v.title}</EntityLink> },
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      sortable: true, sortValue: v => v.applications, render: v => v.applications },
  ]

  return (
    <ScopedListTab<VacancyRow>
      queryKey={`${scope}-vacancies`} endpoint="/vacancies" paramName={paramName} id={id}
      mapRow={mapVacancyRow} columns={columns} searchKeys={['title']}
      searchPlaceholder={t('common:search')} loadingText={t('page.loading')}
      emptyText={t('scopedList.vacanciesEmpty')} errorText={t('scopedList.loadError')}
      onRowClick={v => v.id != null && openEntity('vacancies', v.id)}
    />
  )
}
