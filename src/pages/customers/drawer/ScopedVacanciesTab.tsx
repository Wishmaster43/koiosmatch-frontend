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
 *
 * STATUS FILTER (Danny 05-08 "ik mis de status naast het zoekveld?"): fetches
 * GET /vacancy-statuses directly, same as the customer-level VacanciesTab
 * (VacancyLookupsProvider is only mounted around the Vacancies PAGE) —
 * `resolved` gates handing the list to ScopedListTab so its shared
 * useStatusFilter never guesses a default off the seed slugs before the real
 * lookup answers (mirrors VacanciesTab's own id/name bugfix comment).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import EntityLink from '@/components/ui/EntityLink'
import { useNavigation } from '@/context/NavigationContext'
import { useAuth } from '@/context/AuthContext'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import { AddVacancyModal } from '@/pages/vacancies/shared'
import ScopedListTab from './ScopedListTab'
import { useAllSettings, getStringSetting, useSettingsLoaded } from '@/lib/settings/useAllSettings'
import api, { unwrapList } from '@/lib/api'
import { mapVacancyRow } from '../hooks/useCustomerDrawerData'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'
// Shared seed-status state + status/applications/pencil columns, joined by VacanciesTab (DRY round 11, CUSTTABS2).
import { useSeedVacancyStatusOptions, mapVacancyStatusOptions } from '../hooks/useSeedVacancyStatusOptions'
import type { RawVacancyStatusRow } from '../hooks/useSeedVacancyStatusOptions'
import { vacancyStatusAndActionColumns } from './vacancyListColumns'
import type { Id } from '@/types/common'
import type { Column } from '@/components/ui/DataTable'


// Index signature (mirrors MatchStatus in useMatchStatuses.ts): lets this list feed
// straight into ScopedListTab's `statuses` prop, typed LookupOption[] — structural
// typing only, no runtime change.
interface StatusOpt { value: string; label: string; [k: string]: unknown }

// Seed fallback (mirrors VacanciesTab's own SEED_STATUSES), used only until
// GET /vacancy-statuses answers or if it is unavailable; labels translate at use
// (lookupSeeds.vacancyStatuses.<value>), the Dutch text is the defaultValue.
const SEED_STATUSES: StatusOpt[] = [
  { value: 'open', label: 'Open' }, { value: 'online', label: 'Online' },
  { value: 'concept', label: 'Concept' }, { value: 'paused', label: 'Gepauzeerd' }, { value: 'closed', label: 'Gesloten' },
]

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
  const auth = useAuth()
  // K7b: same permission the Vacancies page itself gates editing on.
  const canEditVacancies = auth?.hasPermission?.('vacancies.update') ?? false
  // hidden without the create permission (OPENERS-HIDE-1, Danny 05-09), same
  // as every other page toolbar — the "+ Vacature" affordance was gated only
  // on customerId being known, letting anyone (not just vacancies.create) open it.
  const canCreateVacancy = auth?.hasPermission?.('vacancies.create') ?? false
  const queryClient = useQueryClient()
  const paramName = scope === 'department' ? 'customer_department_id' : 'customer_location_id'
  const [adding, setAdding] = useState(false)
  // Seeded-until-resolved status state, shared with VacanciesTab (DRY round 11, CUSTTABS2).
  const { statusOptions, setStatusOptions, resolved, setResolved } = useSeedVacancyStatusOptions(t, SEED_STATUSES)
  // Tenant default for this filter — the same setting the customer-level tab reads.
  const settings = useAllSettings()
  const settingsLoaded = useSettingsLoaded()
  const defaultStatusFilter = getStringSetting(settings, 'customer_vacancy_default_status_filter')

  // Load the tenant vacancy-status lookup once — same endpoint/shape VacanciesTab reads.
  useEffect(() => {
    api.get('/vacancy-statuses').then(r => {
      const raw = (unwrapList(r).rows) as RawVacancyStatusRow[]
      const opts = mapVacancyStatusOptions<StatusOpt>(raw)
      if (opts.length) setStatusOptions(opts)
      setResolved(true)
    }).catch(() => setResolved(true))
    // setStatusOptions/setResolved are stable useState setters (now returned by the
    // shared useSeedVacancyStatusOptions hook) — listing them satisfies exhaustive-deps
    // without ever re-running this effect on a render.
  }, [setStatusOptions, setResolved])

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title,
      render: v => <EntityLink tone="neutral" page="vacancies" id={v.id}>{v.title}</EntityLink> },
    // Status/applications/pencil columns, shared with VacanciesTab (DRY round 11, CUSTTABS2).
    ...vacancyStatusAndActionColumns(t, { openEntity, canEditVacancies }),
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
        onAdd={customerId && canCreateVacancy ? () => setAdding(true) : undefined}
        addLabel={t('vacancies.add')}
        // STATUS FILTER: empty until the real lookup resolves (never the seed).
        statuses={resolved ? statusOptions : []}
        statusOf={v => String(v.status.value ?? '')}
        // Parity with the customer-level VacanciesTab: the tenant-configured default
        // filter applies here too (flagged gap, closed 05-08).
        defaultStatus={defaultStatusFilter}
        defaultStatusLoaded={settingsLoaded}
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
