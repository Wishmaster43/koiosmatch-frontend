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
import { Pencil } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
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
import type { Id } from '@/types/common'
import type { Column } from '@/components/ui/DataTable'
import { Mono } from '@/components/ui/typography'
import Button from '@/components/ui/Button'


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
  const queryClient = useQueryClient()
  const paramName = scope === 'department' ? 'customer_department_id' : 'customer_location_id'
  const [adding, setAdding] = useState(false)
  // Translate every seed label at init (per-value key, Dutch literal as fallback) so a
  // failed/empty lookup never leaves a Dutch island in the status filter.
  const seedStatuses = SEED_STATUSES.map(s => ({ ...s, label: t(`lookupSeeds.vacancyStatuses.${s.value}`, { defaultValue: s.label }) }))
  const [statusOptions, setStatusOptions] = useState<StatusOpt[]>(seedStatuses)
  // Has the REAL lookup answered? The seed list must never decide the default
  // selection — mirrors VacanciesTab's own guard (uuid vs seed-slug mismatch).
  const [resolved, setResolved] = useState(false)
  // Tenant default for this filter — the same setting the customer-level tab reads.
  const settings = useAllSettings()
  const settingsLoaded = useSettingsLoaded()
  const defaultStatusFilter = getStringSetting(settings, 'customer_vacancy_default_status_filter')

  // Load the tenant vacancy-status lookup once — same endpoint/shape VacanciesTab reads.
  useEffect(() => {
    api.get('/vacancy-statuses').then(r => {
      const raw = (unwrapList(r).rows) as Array<{ id?: string; value?: string; label?: string; name?: string; active?: boolean }>
      const opts = raw.filter(o => o.active !== false)
        .map(o => ({ value: String(o.id ?? o.value ?? o.name ?? ''), label: String(o.label ?? o.name ?? '') }))
        .filter(o => o.value)
      if (opts.length) setStatusOptions(opts)
      setResolved(true)
    }).catch(() => setResolved(true))
  }, [])

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title,
      render: v => <EntityLink tone="neutral" page="vacancies" id={v.id}>{v.title}</EntityLink> },
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    // K7c/S-custcount-1: ghost-button deep link to this vacancy's own Sollicitaties
    // (applicants) tab — mirrors the customer-level VacanciesTab's own column.
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', sortable: true, sortValue: v => v.applications,
      render: v => (
        <Button variant="ghost" size="sm" aria-label={t('vacancies.col.applicationsOpen')}
          onClick={e => { e.stopPropagation(); openEntity('vacancies', v.id, 'applicants') }}
          style={{ padding: 0, height: 'auto' }}>
          <Mono style={{ fontSize: 12 }}>{v.applications}</Mono>
        </Button>
      ) },
    // K7b: row pencil opening the vacancy's own drawer for editing (fields edit
    // in-place there; no separate edit modal exists, so no fake affordance).
    ...(canEditVacancies ? [{
      key: 'actions', header: '', align: 'right' as const,
      render: (v: VacancyRow) => (
        <Button variant="ghost" size="sm" iconOnly onClick={e => { e.stopPropagation(); openEntity('vacancies', v.id) }}
          title={t('vacancies.editVacancy')} aria-label={t('vacancies.editVacancy')}>
          <Pencil size={12} />
        </Button>
      ),
    }] : []),
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
