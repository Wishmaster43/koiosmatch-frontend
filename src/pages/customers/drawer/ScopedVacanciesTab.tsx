/**
 * ScopedVacanciesTab — the department/location "Vacatures" sub-tab
 * (SCOPED-LIST-TAB-1). Thin adapter over the shared ScopedListTab: picks the
 * right scope param (`customer_location_id` / `customer_department_id`) and
 * reuses the customer-level VacanciesTab's own row mapper + column shape
 * (title link, status pill, applications count) — never a forked copy.
 *
 * Point 1 (Danny's ten-point round): "+ Vacature" opens AddVacancyModal with
 * the customer LOCKED (mirrors the customer-drawer VacanciesTab's own
 * lockCustomerId/lockCustomerName) and the location/department id riding the
 * body silently (that modal has no cascade picker — see its own docblock).
 * VacancyLookupsProvider wraps the modal here too: it is only mounted around
 * the Vacancies PAGE, so opening the modal from any drawer without it throws
 * (caught live 28-07 on the customer-level tab this mirrors).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import { useNavigation } from '@/context/NavigationContext'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import AddVacancyModal from '@/pages/vacancies/AddVacancyModal'
import ScopedListTab from './ScopedListTab'
import { mapVacancyRow } from '../hooks/useCustomerDrawerData'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'
import type { Column } from '@/components/ui/DataTable'

export default function ScopedVacanciesTab({ scope, id, customerId, customerName, scopeName }: {
  scope: 'department' | 'location'; id: Id | undefined
  // Point 1: threaded down from LocationDetail/DepartmentDetail so "+ Vacature"
  // can lock the customer and pre-set the scope — this tab itself only ever
  // asked for `id` before.
  customerId?: Id
  customerName?: string
  scopeName?: string
}) {
  const { t } = useTranslation('customers')
  const { openEntity } = useNavigation()
  const queryClient = useQueryClient()
  const paramName = scope === 'department' ? 'customer_department_id' : 'customer_location_id'
  const [adding, setAdding] = useState(false)

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title,
      render: v => <EntityLink page="vacancies" id={v.id}>{v.title}</EntityLink> },
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      sortable: true, sortValue: v => v.applications, render: v => v.applications },
  ]

  return (
    <>
      <ScopedListTab<VacancyRow>
        queryKey={`${scope}-vacancies`} endpoint="/vacancies" paramName={paramName} id={id}
        mapRow={mapVacancyRow} columns={columns} searchKeys={['title']}
        searchPlaceholder={t('common:search')} loadingText={t('page.loading')}
        emptyText={t('scopedList.vacanciesEmpty')} errorText={t('scopedList.loadError')}
        onRowClick={v => v.id != null && openEntity('vacancies', v.id)}
        // Point 1: only offered once the caller actually knows the customer —
        // otherwise there is nothing to lock the create form to (§3).
        onAdd={customerId ? () => setAdding(true) : undefined}
        addLabel={t('vacancies.add')}
      />
      {adding && (
        <VacancyLookupsProvider>
          <AddVacancyModal
            onClose={() => setAdding(false)}
            onCreated={() => { setAdding(false); queryClient.invalidateQueries({ queryKey: [`${scope}-vacancies`, '/vacancies', paramName, id] }) }}
            lockCustomerId={customerId != null ? String(customerId) : undefined}
            lockCustomerName={customerName}
            initialCustomerLocationId={scope === 'location' && id != null ? String(id) : undefined}
            initialCustomerDepartmentId={scope === 'department' && id != null ? String(id) : undefined}
            initialCustomerLocationName={scope === 'location' ? scopeName : undefined}
            initialCustomerDepartmentName={scope === 'department' ? scopeName : undefined}
          />
        </VacancyLookupsProvider>
      )}
    </>
  )
}
