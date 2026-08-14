/**
 * CustomerApplicationsList — the "Sollicitaties" sub-tab, TWO entry modes
 * (SOLLICITATIES-SCOPE-1, Danny asked three times at customer level, then again
 * for location/department): Lists application RECORDS — one candidate can appear
 * more than once, since a row is one application, not one person ("sollicitant"
 * is a derived person-state, §3B).
 *
 * MODE 1 — `customerId` (original, landed c0e0d900): GET /applications?
 * customer_id[]={id} (ApplicationQuery validates `customer_id` as an ARRAY of
 * uuids — measured in ApplicationQuery.php:82-83). Used by the customer-level
 * VacanciesTab.
 *
 * MODE 2 — `vacancyIds` (this level's OWN vacancy ids, plus that step's own
 * loading/error): GET /applications?vacancy_id[]=… over those ids. Used by
 * LocationDetail/DepartmentDetail, which resolve the ids themselves (step 1 of
 * the chain, via useScopedVacancyIds — the SAME scoped query the Vacatures
 * sub-tab uses, so an already-opened Vacatures tab answers from cache) and hand
 * them down already-loaded so the two-step chain still reads as ONE coherent
 * state here (`vacancyIdsLoading`/`vacancyIdsError` fold into this component's
 * own loading/error). See useApplicationsByVacancyIds for the empty-array guard
 * (an empty `vacancy_id[]` would otherwise return every application).
 *
 * Both modes are LAZY: this component only mounts (and only then fires its own
 * query) once its sub-tab is opened — the same lazy-on-open pattern
 * CustomerNotesTab uses for its own sub-tabs.
 *
 * Reuses the applications PAGE's own row mapper (mapApplication, via the fetch
 * hooks) rather than a third copy — mirrors ScopedMatchesTab's mapMatch reuse.
 * The COLUMN SET is its own, though: narrow-drawer-panel precedent
 * (ScopedMatchesTab/ScopedVacanciesTab both stay at 3-4 columns, explicitly
 * reasoned as "no existing precedent" for more) beats importing the full
 * ApplicationsTable's 11 columns — client/interview/source/task/owner are one
 * click away in the application's own drawer, and client is redundant here
 * (every row already belongs to this customer). Candidate/Vacancy/Phase/Score/
 * Created mirror the applications table's own cells and phase-chip convention
 * (StatusPill) 1:1 — identical toolbar/columns/row-click in either mode.
 *
 * S-custlist-1: every row now carries the SAME action cluster the candidate
 * drawer's own application row carries — pencil-edit (reuses the candidate
 * drawer's `AddApplicationModal` in edit mode, never a second form) + an
 * expand chevron that lazily loads `ApplicationRowDetails` (the exact
 * candidate-drawer detail panel, reused as-is) in a small anchored popover
 * (mirrors `ChangelogPopover`'s own anchored-FloatingPanel shape). Both are
 * gated on the same `applications.update`/`applications.view` permissions the
 * candidate side gates on. The candidate cell's own `EntityLink` to the
 * application record was already in place — unchanged.
 *
 * DATATABLE-EXPAND-1 evaluation (2026-08-14): NOT migrated to DataTable's new
 * shared `renderExpanded` — deliberate, not an oversight. This chevron opens
 * `ApplicationRowDetails` in a small ANCHORED FLOATING PANEL next to the
 * button (see `FloatingPanel`/`persistKey="customer-application-row"`), sized
 * and positioned independently of the table's row flow. `renderExpanded`
 * instead opens a full-width <tr> panel BELOW the row, pushing every row
 * under it down — a real layout/behaviour change from the current popover,
 * so migrating here would violate the brief's "without behaviour loss". Left
 * as-is; a future screen that wants the full-width inline-panel look is the
 * right place to adopt `renderExpanded`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Pencil, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import FloatingPanel from '@/components/ui/FloatingPanel'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useNavigation } from '@/context/NavigationContext'
import { useLookups } from '@/context/LookupsContext'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { queryClient } from '@/lib/queryClient'
// S-custlist-1: reuse, never fork — the exact candidate-drawer edit form and
// detail panel (see the docblock above).
import CandidateAddApplicationModal from '@/pages/candidates/drawer/AddApplicationModal'
import ApplicationRowDetails from '@/pages/candidates/drawer/ApplicationRowDetails'
import { useCustomerApplications, useApplicationsByVacancyIds } from '../hooks/useCustomerDrawerData'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'

// Mode 2 additionally carries step 1's own loading/error (see the file docblock)
// so LocationDetail/DepartmentDetail never need to render a second loading/error
// UI of their own — this component folds both steps into one coherent state.
type Props =
  | { customerId?: Id }
  | { vacancyIds: Id[]; vacancyIdsLoading: boolean; vacancyIdsError?: boolean }

export default function CustomerApplicationsList(props: Props) {
  const { t } = useTranslation(['customers', 'applications', 'candidates'])
  const { openEntity } = useNavigation()
  const { formatDate } = useDateFormat()
  // The tenant funnel-stage lookup — global LookupsContext, already mounted app-wide
  // (unlike VacancyLookupsContext), so no extra fetch is needed here. Drives both the
  // phase pill's label/colour (mirrors ApplicationsPage's own `decorate` step) and the
  // phase filter's options.
  const { funnelTypes, funnelMeta } = useLookups()
  // S-custlist-1: same permission gates the candidate side reads for its own
  // pencil/expand-chevron — applications.update for PATCH, applications.view for
  // GET /applications/{id} (what the expand panel loads).
  const auth = useAuth()
  const canManageApplications = auth?.hasPermission?.('applications.update') ?? false
  const canViewApplications = auth?.hasPermission?.('applications.view') ?? false
  // Pencil target (edit modal) + expand target (detail popover) — one at a time each.
  const [editApplicationId, setEditApplicationId] = useState<Id | null>(null)
  const [editCandidateId, setEditCandidateId] = useState<Id | null>(null)
  const [expandedId, setExpandedId] = useState<Id | null>(null)

  // Split the union into plain locals — `vacancyIds` presence on the prop object
  // is the mode switch (never passed alongside `customerId`, see the Props type
  // above), so the rest of this component reads identically either way.
  let customerId: Id | undefined
  let vacancyIds: Id[] = []
  let vacancyIdsLoading = false
  let vacancyIdsError = false
  if ('vacancyIds' in props) {
    vacancyIds = props.vacancyIds
    vacancyIdsLoading = props.vacancyIdsLoading
    vacancyIdsError = Boolean(props.vacancyIdsError)
  } else {
    customerId = props.customerId
  }

  // Both fetch hooks are called unconditionally (Rules of Hooks) — only the
  // active mode's own `enabled` guard (inside each hook) actually fires a
  // request; the other mode's inputs are empty/undefined so its query stays off.
  const byCustomer = useCustomerApplications(customerId, funnelTypes)
  const byVacancies = useApplicationsByVacancyIds(vacancyIds, funnelTypes)
  const scoped = 'vacancyIds' in props
  const { rows, loading, error } = scoped
    ? { rows: byVacancies.rows, loading: vacancyIdsLoading || byVacancies.loading, error: vacancyIdsError || byVacancies.error }
    : byCustomer
  const [search, setSearch] = useState('')

  // Same decorate step as ApplicationsPage: phaseKey -> label/colour via the tenant lookup.
  const decorated = rows.map(a => { const m = funnelMeta(a.phaseKey); return { ...a, phaseLabel: m.label, phaseColor: m.color } })

  // Phase filter — the shared StatusFilterSelect/useStatusFilter, keyed on phaseKey.
  // No tenant default: unlike the vacancy-status "active only" guess, a funnel phase
  // has no comparable heuristic worth proposing here, so it starts unfiltered.
  const { value: phaseFilter, toggle: togglePhase, filtered: phaseRows } =
    useStatusFilter(decorated, funnelTypes, r => r.phaseKey)

  // Free-text search on top of the phase filter — candidate name + vacancy title.
  const q = search.trim().toLowerCase()
  const filteredRows = q
    ? phaseRows.filter(a => [a.candidateName, a.vacancyTitle].some(v => String(v ?? '').toLowerCase().includes(q)))
    : phaseRows

  const columns: Column<Application>[] = [
    // Candidate — avatar + name, linked to the APPLICATION record (this list is
    // about application rows, not the candidate/vacancy on either side of it).
    { key: 'candidate', header: t('applications:cols.candidate'), sortable: true, sortValue: r => r.candidateName,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={r.candidateInitials} size={22} soft />
          <EntityLink page="applications" id={r.id}>{r.candidateName}</EntityLink>
          {/* V-appdetail-1: at a requires_appointment phase with no planned
              appointment — icon + tooltip text, never colour/icon alone (§6). */}
          {r.missingAppointment && (
            <span role="img" aria-label={t('applications:missingAppointment')} title={t('applications:missingAppointment')}
              style={{ display: 'inline-flex', flexShrink: 0 }}>
              <AlertTriangle size={13} color="var(--color-warning)" aria-hidden="true" />
            </span>
          )}
        </span>
      ) },
    { key: 'vacancy', header: t('applications:cols.vacancy'), sortable: true, sortValue: r => r.vacancyTitle,
      cellStyle: { color: 'var(--text)' }, render: r => r.vacancyTitle },
    // Funnel phase — the applications table's own phase-chip convention (StatusPill).
    { key: 'phase', header: t('applications:cols.phase'), sortable: true, sortValue: r => r.phaseLabel ?? '',
      render: r => <StatusPill label={r.phaseLabel} color={r.phaseColor} /> },
    { key: 'score', header: t('applications:cols.score'), align: 'right', sortable: true, sortValue: r => r.score ?? -1,
      render: r => r.score != null ? <span style={{ fontWeight: 600 }}>{r.score}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'created', header: t('applications:cols.created'), nowrap: true, sortable: true, sortValue: r => r.created ?? '',
      cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, render: r => r.created ? formatDate(r.created) : '—' },
    // S-custlist-1: pencil-edit + expand-with-lazy-detail — same action cluster
    // the candidate drawer's own ApplicationRow carries. Never rendered when
    // the viewer holds neither permission (§3: no dead affordance).
    ...(canManageApplications || canViewApplications ? [{
      key: 'actions', header: '', align: 'right' as const,
      render: (r: Application) => (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} onClick={e => e.stopPropagation()}>
          {canManageApplications && r.id != null && (
            <button type="button" onClick={() => { setEditCandidateId(r.candidateId ?? null); setEditApplicationId(r.id ?? null) }}
              title={t('candidates:work.editApplication')} aria-label={t('candidates:work.editApplication')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Pencil size={12} />
            </button>
          )}
          {canViewApplications && r.id != null && (
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <button type="button" onClick={() => setExpandedId(x => x === r.id ? null : (r.id ?? null))}
                title={expandedId === r.id ? t('candidates:work.hideDetails') : t('candidates:work.showDetails')}
                aria-label={expandedId === r.id ? t('candidates:work.hideDetails') : t('candidates:work.showDetails')}
                aria-expanded={expandedId === r.id} aria-haspopup="dialog"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)' }}>
                {expandedId === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {/* Lazy detail — the SAME candidate-drawer panel, only fetched on first expand (§8). */}
              <FloatingPanel open={expandedId === r.id} onClose={() => setExpandedId(null)}
                ariaLabel={t('candidates:work.showDetails')} width={360} persistKey="customer-application-row"
                bodyStyle={{ padding: 0 }} hideClose>
                <ApplicationRowDetails applicationId={r.id} id={`custapp-panel-${r.id}`} labelledBy={`custapp-toggle-${r.id}`} />
              </FloatingPanel>
            </span>
          )}
        </span>
      ),
    }] : []),
  ]

  // Explicit ERROR state — never a table that silently renders as "empty".
  if (error) {
    return <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger)', padding: '8px 0' }}>{t('applications:error')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar mirrors the sibling sub-entity lists: search left, phase filter right. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('applications:page.searchPlaceholder')} aria-label={t('applications:page.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={phaseFilter} onToggle={togglePhase} statuses={funnelTypes} />
      </div>
      <DataTable columns={columns} rows={filteredRows} loading={loading} loadingText={t('applications:loading')}
        emptyText={t('applications:empty')} onRowClick={r => r.id != null && openEntity('applications', r.id)} />

      {/* S-custlist-1 reuse: the SAME candidate-drawer edit form, EDIT mode
          (PATCH /applications/{id}) — never a second form. Refetches both
          possible data sources on success (only the active mode's query is
          ever actually subscribed, the other is a harmless no-op match). */}
      {editApplicationId != null && editCandidateId != null && (
        <CandidateAddApplicationModal candidateId={editCandidateId} editApplicationId={editApplicationId}
          onClose={() => { setEditApplicationId(null); setEditCandidateId(null) }}
          onCreated={() => {
            setEditApplicationId(null); setEditCandidateId(null)
            queryClient.invalidateQueries({ predicate: q => Array.isArray(q.queryKey) && q.queryKey.includes('applications') })
          }} />
      )}
    </div>
  )
}
