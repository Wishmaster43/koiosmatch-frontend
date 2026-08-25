/**
 * VacanciesTab — a thin two-sub-tab host (Danny, asked three times: "Tabblad
 * Vacatures moet 2 subtabbladen hebben: Vacatures en Sollicitaties" — "the
 * Vacancies tab needs 2 sub-tabs: Vacancies and Applications"): Vacatures
 * (this customer's vacancies — unchanged below) and Sollicitaties (the
 * application RECORDS on those vacancies, `CustomerApplicationsList`). The
 * Vacatures sub-tab is via useCustomerVacanciesWithPublished → GET /vacancies?
 * customer_id={id}), with a multi-select STATUS filter above the table — the same
 * searchable checkbox-list pattern as the right filter panel's Accountmanager
 * filter (SearchSelectGroup), reused here rather than hand-rolled. Statuses come
 * from the tenant vacancy-status lookup (GET /vacancy-statuses) —
 * VacancyLookupsProvider is only mounted around the Vacancies page, not the
 * customer drawer, so this fetches the same endpoint directly.
 *
 * DEFAULT VIEW = the customer table's `open_vacancies_count` column, exactly (K2-FE
 * 13-08 repair — the previous default only matched the "not is_closed" half of that
 * definition). The BE definition (CustomerController.php:102,
 * VacancyStatus::excludeClosed, app/Models/VacancyStatus.php:84-100) is:
 *   published === true AND (status NOT is_closed-flagged OR status ABSENT)
 * i.e. a vacancy without a status stays eligible. This tab reproduces all three parts
 * in the DEFAULT state: `publishedRows` filters to `published === true`,
 * `guessDefault` (strictGuess) selects every NOT-`is_closed` status straight from the
 * lookup flags — even when that matches zero rows, so an all-closed customer shows 0
 * like its column — and `alwaysMatch` keeps status-less rows visible. Known quirk, by
 * design: `alwaysMatch` also bypasses a MANUALLY narrowed status selection, so
 * status-less rows stay visible while filtering to one specific status.
 * Unpublished vacancies stay reachable via the explicit `showUnpublished` toggle —
 * never silently unreachable.
 *
 * Sollicitaties is LAZY: `CustomerApplicationsList` only mounts (and only then
 * fires its own query) once that sub-tab is opened — it isn't rendered at all
 * while Vacatures is active, mirroring CustomerNotesTab's own lazy sub-tabs.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { Search, Pencil } from 'lucide-react'
import { AddVacancyModal } from '@/pages/vacancies/shared'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomerApplicationsList from './CustomerApplicationsList'
import { useAllSettings, useSettingsLoaded, getStringSetting } from '@/lib/settings/useAllSettings'
import { useAuth } from '@/context/AuthContext'
import { useNavigation } from '@/context/NavigationContext'
import api, { unwrapList } from '@/lib/api'
import { mapVacancyRow } from '../hooks/useCustomerDrawerData'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'
import { Mono } from '@/components/ui/typography'
import Button from '@/components/ui/Button'

// K7c/K7b: the same ghost-button count deep-link VacanciesTable.tsx uses for its
// own Applications/Matches columns (leadsBtn there) — reused here under its own
// name since this file has no shared style import for it.

// K2-FE (13-08): `VacancyRow` (useCustomerDrawerData) has no `published` field, but the
// BE's open definition needs it (see below), so this tab carries its own extended row
// shape rather than widening the shared mapper for every OTHER caller of it.
type PublishedVacancyRow = VacancyRow & { published: boolean }

// This tab's own vacancy fetch (deliberately NOT `useCustomerVacancies`): it reuses the
// shared `mapVacancyRow` for title/status/applications, then adds `published` on top —
// the one field the shared mapper omits and this tab's default filter needs. Same
// queryKey prefix (`['customers', customerId, 'vacancies', …]`) as before, so the
// existing `queryClient.invalidateQueries` call below (on create) still hits it.
function useCustomerVacanciesWithPublished(customerId?: Id, params?: Record<string, unknown>) {
  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['customers', customerId, 'vacancies', params ?? {}],
    enabled: !!customerId,
    queryFn: async ({ signal }): Promise<PublishedVacancyRow[]> =>
      unwrapList<Record<string, unknown>>(await api.get('/vacancies', { params: { customer_id: customerId, ...params }, signal }))
        .rows.map(v => ({ ...mapVacancyRow(v), published: v.published === true })),
  })
  return { rows: data, loading }
}

// K2-FE: carries `isClosed` alongside value/label so the default filter can select
// "every NOT-closed status" — one of the three conditions `open_vacancies_count`
// requires (published + not-is_closed + status-absent-stays-eligible; see the
// file docblock for the full definition and where each part is implemented).
interface StatusOpt { value: string; label: string; isClosed: boolean }

// Seed fallback (mirrors VacancyLookupsContext's DEFAULT_VACANCY_STATUSES) — used
// only until GET /vacancy-statuses answers or if it is unavailable; labels translate
// at use (lookupSeeds.vacancyStatuses.<value>), the Dutch text is the defaultValue.
const SEED_STATUSES: StatusOpt[] = [
  { value: 'open', label: 'Open', isClosed: false }, { value: 'online', label: 'Online', isClosed: false },
  { value: 'concept', label: 'Concept', isClosed: false }, { value: 'paused', label: 'Gepauzeerd', isClosed: false },
  { value: 'closed', label: 'Gesloten', isClosed: true },
]

export default function VacanciesTab({ customerId, customerName, params }: { customerId?: Id; customerName?: string; params?: Record<string, unknown> }) {
  const { t } = useTranslation(['customers', 'applications'])
  const { openEntity } = useNavigation()
  const auth = useAuth()
  // K7b: same permission the Vacancies page itself gates editing on.
  const canEditVacancies = auth?.hasPermission?.('vacancies.update') ?? false
  // Two sub-tabs (SubTabBar) — Vacatures stays the default so this tab's behaviour
  // is unchanged for anyone who never opens Sollicitaties.
  const [subTab, setSubTab] = useState<'vacancies' | 'applications'>('vacancies')
  const { rows, loading } = useCustomerVacanciesWithPublished(customerId, params)
  // Explicit, reversible control (acceptance #2) to reach unpublished vacancies — the
  // default view hides them (matching the open-count definition below), but this toggle
  // makes them reachable again rather than silently unreachable behind a hidden filter.
  const [showUnpublished, setShowUnpublished] = useState(false)
  // Create a vacancy straight from the customer (Danny 28-07) — the client is fixed to
  // this customer, so the modal shows it read-only instead of asking again.
  const [adding, setAdding] = useState(false)
  // Free-text search over the title (Danny 28-07) — the list can run to dozens of rows.
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  // Translate every seed label in the LAZY state initialiser (per-value key, Dutch
  // literal as fallback) so a failed/empty lookup never leaves a Dutch island in the
  // status filter, and the map runs once instead of on every render.
  const [statusOptions, setStatusOptions] = useState<StatusOpt[]>(() =>
    SEED_STATUSES.map(s => ({ ...s, label: t(`lookupSeeds.vacancyStatuses.${s.value}`, { defaultValue: s.label }) })))
  // Has the REAL lookup answered? The seed list must never decide the default
  // selection — see the id/name bug documented below.
  const [resolved, setResolved] = useState(false)

  // Load the tenant vacancy-status lookup once.
  // BUG FIX (Danny 28-07: "Open maar staat niet aangevinkt?????" — "Open but it isn't
  // checked??" — while the table said "Geen vacatures voor deze klant" — "No vacancies
  // for this customer"): this mapped the option VALUE off `name`, but
  // `GET /vacancy-statuses` returns no `value` at all — it returns `id` (a uuid) +
  // `name`. A vacancy row carries that UUID in `status.value`, so the filter compared
  // "Open" against a uuid, matched nothing, and silently hid every vacancy. The option
  // value is now the id, exactly what the rows carry.
  // K2-FE (13-08): also carries `is_closed` through — the default-filter guess below
  // needs it (BE definition: CustomerController::open_vacancies_count = published AND
  // NOT is_closed), so the tab's default must key off the same flag, not a slug guess.
  useEffect(() => {
    api.get('/vacancy-statuses').then(r => {
      const raw = (unwrapList(r).rows) as Array<{ id?: string; value?: string; label?: string; name?: string; active?: boolean; is_closed?: boolean }>
      const opts = raw.filter(o => o.active !== false)
        .map(o => ({ value: String(o.id ?? o.value ?? o.name ?? ''), label: String(o.label ?? o.name ?? ''), isClosed: o.is_closed === true }))
        .filter(o => o.value)
      if (opts.length) setStatusOptions(opts)
      setResolved(true)
    }).catch(() => setResolved(true))
  }, [])

  // Tenant-configured default status filter (TENANT-DEFAULT-1, Danny 02-08) — replaces
  // the old "active only" guess when Settings → Klanten → Tabelweergave → Vacatures has
  // one saved; absent (null) falls back to that original guess unchanged. `settingsLoaded`
  // stops the hook from deciding before /settings has actually answered (see its own docblock).
  const settings = useAllSettings()
  const settingsLoaded = useSettingsLoaded()
  const defaultStatusFilter = getStringSetting(settings, 'customer_vacancy_default_status_filter')

  // Published filter (BE: `open_vacancies_count` = published === true AND …, see below) —
  // applied BEFORE the status filter so the status guess/count operate on the same set
  // the column counts. `showUnpublished` lifts this restriction explicitly (acceptance #2).
  const publishedRows = useMemo(() => showUnpublished ? rows : rows.filter(v => v.published), [rows, showUnpublished])

  // The SHARED status filter, same as every other sub-entity list (Danny 28-07:
  // "vacature status is niet hetzelfde als locatie status???" — "vacancy status
  // isn't the same as location status???"). Two things make it safe
  // here: it is handed the statuses ONLY once the real lookup resolved — otherwise it
  // would propose a default off the seed list's slugs, the other half of the same bug —
  // and `keyOf` points it at this row's status OBJECT, because comparing a uuid to an
  // object matches nothing, silently.
  // K2-FE (13-08): the FULL BE definition (CustomerController.php:102,
  // VacancyStatus::excludeClosed, app/Models/VacancyStatus.php:84-100) is
  // `published === true AND (status NOT is_closed-flagged OR status ABSENT)`. `guessDefault`
  // covers the "not is_closed" half; `alwaysMatch` covers the "status ABSENT stays eligible"
  // half (a status-less row has no lookup id to appear in `guessDefault`'s selection, so it
  // would otherwise vanish the moment the guess proposes a non-empty set); `publishedRows`
  // above covers the "published === true" half. Together the default view matches
  // `open_vacancies_count` exactly (acceptance #1).
  const { value: statusFilter, toggle: toggleStatus, filtered: statusRows } =
    useStatusFilter(publishedRows, resolved ? statusOptions.map(o => ({ value: o.value, label: o.label, isClosed: o.isClosed })) : [],
      v => String(v.status.value ?? ''), defaultStatusFilter, settingsLoaded,
      opts => opts.filter(o => !o.isClosed).map(o => o.value),
      v => !v.status.value,
      // strictGuess: the not-is_closed default comes from the lookup FLAGS, so it
      // applies even when zero rows match — an all-closed customer honestly shows 0,
      // exactly like its open_vacancies_count column.
      true)


  // Free-text search runs on top of the status filter's rows.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? statusRows.filter(v => String(v.title ?? '').toLowerCase().includes(q)) : statusRows
  }, [statusRows, search])

  const columns: Column<PublishedVacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title, render: v => <EntityLink page="vacancies" id={v.id}>{v.title}</EntityLink> },
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    // K7c/S-custcount-1: ghost-button deep link to this vacancy's own Sollicitaties
    // (applicants) tab — same visual/intent as VacanciesTable.tsx's own applications
    // count column, routed cross-page via openEntity's optional tab argument.
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', sortable: true, sortValue: v => v.applications,
      render: v => (
        <Button variant="ghost" size="sm" aria-label={t('vacancies.col.applicationsOpen')}
          onClick={e => { e.stopPropagation(); openEntity('vacancies', v.id, 'applicants') }}
          style={{ padding: 0, height: 'auto' }}>
          <Mono style={{ fontSize: 12 }}>{v.applications}</Mono>
        </Button>
      ) },
    // K7b: row pencil opening the vacancy's own drawer for editing — mirrors
    // CustomerApplicationsList's pencil action cluster (its edit lives in a modal;
    // a vacancy's fields edit in-place inside its own drawer, so the pencil opens
    // that drawer rather than a second, non-existent edit modal — no fake affordance).
    ...(canEditVacancies ? [{
      key: 'actions', header: '', align: 'right' as const,
      render: (v: PublishedVacancyRow) => (
        <Button variant="ghost" size="sm" iconOnly onClick={e => { e.stopPropagation(); openEntity('vacancies', v.id) }}
          title={t('vacancies.editVacancy')} aria-label={t('vacancies.editVacancy')}>
          <Pencil size={12} />
        </Button>
      ),
    }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Sub-tab labels reuse existing keys (grepped before minting): "Vacatures" is
          the same drawer.tabs.vacancies used elsewhere on this same customer drawer;
          "Sollicitaties" is the applications page's own top-level title — both already
          carry full nl/en/de/fr/es parity, so no new i18n key is needed for either. */}
      <SubTabBar
        tabs={[
          { id: 'vacancies', label: t('drawer.tabs.vacancies') },
          { id: 'applications', label: t('applications:title') },
        ]}
        active={subTab}
        onChange={id => setSubTab(id as 'vacancies' | 'applications')}
      />
      {subTab === 'vacancies' && (
        <>
          {/* Toolbar in the house order (Danny 28-07): search left, status filter right,
              add trigger last — the same left-to-right reading as every other sub-entity
              list. The filter renders `plain` so it is white like the pickers beside it.
              K2-FE (13-08): the `showUnpublished` toggle sits beside the status filter —
              the one explicit, reversible control (acceptance #2) that reaches vacancies
              the default published-only view hides, via the shared QuickViewToggle so it
              looks like every other quick-view toggle in the app (§4). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <Search size={13} color="var(--text-muted)" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('vacancies.searchPlaceholder')} aria-label={t('vacancies.searchPlaceholder')}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
            </div>
            <StatusFilterSelect value={statusFilter} onToggle={toggleStatus}
              statuses={statusOptions.map(o => ({ value: o.value, label: o.label }))} />
            <QuickViewToggle active={showUnpublished} onToggle={() => setShowUnpublished(v => !v)}
              label={t('vacancies.showUnpublished')} size="compact" />
            <DrawerAddButton onClick={() => setAdding(true)} label={t('vacancies.add')} />
          </div>
          <DataTable columns={columns} rows={filteredRows} loading={loading} loadingText={t('page.loading')} emptyText={t('vacancies.empty')} />
        </>
      )}
      {/* Sollicitaties — lazy: not rendered (so no fetch fires) until this sub-tab
          is actually opened. */}
      {subTab === 'applications' && <CustomerApplicationsList customerId={customerId} />}

      {/* Refetch this customer's vacancy list on create, so the new row appears here. */}
      {/* The modal reads useVacancyLookups, whose provider is only mounted around the
          Vacancies PAGE — opening it from this drawer threw "must be used within a
          VacancyLookupsProvider" (caught live 28-07). Mount the provider around the modal
          itself so the same component works from either entry point. */}
      {adding && (
        <VacancyLookupsProvider>
        <AddVacancyModal
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'vacancies'] }) }}
          lockCustomerId={customerId != null ? String(customerId) : undefined}
          lockCustomerName={customerName}
        />
        </VacancyLookupsProvider>
      )}
    </div>
  )
}
