/**
 * TargetsTab — the call list itself: one COMPACT row per target (candidate) with
 * a status soft-chip, quick check-off actions and — once handled — the call
 * OUTCOME (Danny 2026-07-04): outcome chips from the /outreach-outcomes lookup +
 * follow-ups (new task pre-linked to the candidate · create a match on a
 * vacancy), tucked behind a per-row expand toggle so large lists stay scannable
 * (BELLIJST-SCALE-1, Danny 2026-08-14: "how is an
 * end user supposed to select the underlying 400 candidates one by one?").
 * A name/status/outcome/
 * assignee search+filter bar narrows the already-loaded set client-side — no
 * backend change, works on whatever the campaign returned. The name clicks
 * through to the candidate drawer. Row selection + AssignTargetsBar (G29)
 * divide the pick round-robin over chosen recruiters; each row also carries its
 * own note (G30) and, once assigned, its recruiter. `filter` (G31 — set by the
 * Stats tab's donut clicks) narrows the visible rows to one status/outcome/
 * assignee value, combined with the local search/filter bar. Presentational;
 * data + mutations come from useOutreachDetail via the drawer.
 *
 * BELLIJST-NOTE-POPOUT-1: the per-target note (TargetNoteField) carries a
 * second-screen pop-out; `campaignId` + `onApplyTargetNote` exist only to wire
 * that window's talk-back channel to the campaign-level state (see
 * TargetNoteField's own docblock).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Caption } from '@/components/ui/typography'
import { AddTaskModal } from '@/pages/tasks/shared'
import { TaskLookupsProvider } from '@/context/TaskLookupsContext'
import { useOutreachOutcomes } from '@/lib/useOutreachOutcomes'
import { useOutreachStatuses } from '@/lib/useOutreachStatuses'
import { useVacancyOptions } from '@/pages/candidates/shared'
import TargetRow from './TargetRow'
import TargetsFilterBar from './TargetsFilterBar'
import TargetsActiveFilterChip from './TargetsActiveFilterChip'
import TargetsSelectionHeader from './TargetsSelectionHeader'
import { targetCandidateName as candidateName } from './targetName'
import { useOutreachTargets } from '../hooks/useOutreachTargets'
import type { OutreachTarget, AssignResult } from '../hooks/useOutreachDetail'
import type { TargetSelection, AssigneeAxes } from '../data/outreachApi'
import type { TargetFilter } from './targetFilter'

interface RecruiterOption { value: string; label: string }

// The call list itself (see the module doc above): presentational, all data/mutations come from useOutreachDetail via the drawer.
export default function TargetsTab({ targets, loading, error, onSetStatus, onSetOutcome,
  onSetNote, campaignId = '', onApplyTargetNote, recruiters = [], onAssignTargets, filter = null, onClearFilter }: {
  targets: OutreachTarget[]
  loading: boolean
  error: boolean
  onSetStatus: (id: string, status: string) => void
  onSetOutcome: (id: string, outcome: string | null) => void
  // G30 — per-target note; omitted in older callers keeps the field read-only.
  onSetNote?: (id: string, note: string) => Promise<void>
  // BELLIJST-NOTE-POPOUT-1: the campaign this tab belongs to — the note field's
  // second-screen window addresses one target through a <campaignId>:<targetId>
  // composite id (no standalone GET /outreach-targets/{id} exists).
  campaignId?: string
  // Adopts a note the note field's pop-out window already persisted on its own
  // PATCH, into the campaign-level state (useOutreachDetail.applyTargetNote) —
  // local state only, so a collapsed-then-re-expanded row never reads stale text.
  onApplyTargetNote?: (id: string, note: string) => void
  // G29 — recruiters selectable in the assign picker + the mutation itself;
  // omitted (or empty) hides the whole assign affordance (no fake control).
  recruiters?: RecruiterOption[]
  onAssignTargets?: (selection: TargetSelection, assignee: AssigneeAxes) => Promise<AssignResult>
  // G31 — the Stats tab's active donut pick; narrows the visible rows.
  filter?: TargetFilter
  onClearFilter?: () => void
}) {
  const { t } = useTranslation('outreach')
  const { outcomes } = useOutreachOutcomes()
  // Entry statuses from the tenant lookup (R-1b) — the is_reached FLAG drives
  // behaviour, so tenant-added statuses appear here without any code change.
  const { statuses, metaOf, initial } = useOutreachStatuses()
  // Per-row follow-up state: which target has the task modal open.
  const [taskFor,  setTaskFor]  = useState<OutreachTarget | null>(null)
  // Row-selection/expand state + the direct-match mutation live in the shared hook.
  const {
    selected, setSelected, toggleRow,
    expanded, toggleExpanded,
    matchFor, setMatchFor, matchVacancyId, setMatchVacancyId, matchSaving, confirmMatch,
  } = useOutreachTargets()
  // BELLIJST-ASSIGN-2: "assign everyone matching the current filter" — a second
  // entry point into AssignTargetsBar that sends `filters` instead of `ids`, so a
  // filtered set larger than the loaded page (a filter is server-unaware today,
  // client-side over what's loaded, but the SAME axis values the backend's own
  // filter vocabulary understands) can be divided without ticking every row.
  const [assignAllFiltered, setAssignAllFiltered] = useState(false)
  // Vacancy options only load while the match prompt is open.
  const vacancyOptions = useVacancyOptions(!!matchFor)
  // BELLIJST-SCALE-1 — client-side search + filter bar on the already-loaded set
  // (no backend pagination yet); combined with the Stats-tab `filter` above.
  const [search, setSearch] = useState('')
  const [statusPick, setStatusPick] = useState<string | null>(null)
  const [outcomePick, setOutcomePick] = useState<string | null>(null)
  const [assigneePick, setAssigneePick] = useState<string | null>(null)
  // Assignee options derived from the loaded targets themselves (+ an
  // "unassigned" sentinel) — no extra endpoint needed for a client-side filter.
  const assigneeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    targets.forEach(tg => { if (tg.assignee?.id && tg.assignee.name) seen.set(String(tg.assignee.id), tg.assignee.name) })
    return [{ value: '', label: t('workflows:unassigned') }, ...[...seen.entries()].map(([value, label]) => ({ value, label }))]
  }, [targets, t])

  // G31 — one target matches the active filter axis/value; no filter = everything.
  const matchesFilter = (tg: OutreachTarget): boolean => {
    if (!filter) return true
    if (filter.axis === 'status')   return (tg.status ?? initial?.value ?? 'todo') === filter.value
    if (filter.axis === 'outcome')  return (tg.outcome ?? '') === filter.value
    return String(tg.assignee?.id ?? '') === filter.value
  }
  // BELLIJST-SCALE-1 — the local search/filter bar narrows the same set the
  // Stats-tab `filter` narrows; both apply together (AND), search on name only.
  const matchesLocalFilters = (tg: OutreachTarget): boolean => {
    if (search.trim() && !candidateName(tg).toLowerCase().includes(search.trim().toLowerCase())) return false
    if (statusPick && (tg.status ?? initial?.value ?? 'todo') !== statusPick) return false
    if (outcomePick && (tg.outcome ?? '') !== outcomePick) return false
    if (assigneePick !== null && String(tg.assignee?.id ?? '') !== assigneePick) return false
    return true
  }
  const visibleTargets = targets.filter(tg => matchesFilter(tg) && matchesLocalFilters(tg))
  const hasLocalFilters = !!search.trim() || !!statusPick || !!outcomePick || assigneePick !== null
  const filterLabel = filter?.axis ? t(`drawer.stats.axis.${filter.axis}`) : ''
  // BELLIJST-ASSIGN-2: the active filter axes translated into the backend's
  // `filters` selection shape — same field names the assignee/status/outcome
  // pickers already use, so "assign all matching" reaches rows beyond this page.
  const currentFilters = useMemo(() => {
    const f: Record<string, unknown> = {}
    if (filter?.axis === 'status') f.status = filter.value
    if (filter?.axis === 'outcome') f.outcome = filter.value
    if (filter?.axis === 'assignee') f.assignee_id = filter.value || null
    if (statusPick) f.status = statusPick
    if (outcomePick) f.outcome = outcomePick
    if (assigneePick !== null) f.assignee_id = assigneePick || null
    if (search.trim()) f.search = search.trim()
    return f
  }, [filter, statusPick, outcomePick, assigneePick, search])
  const hasAnyFilter = hasLocalFilters || !!filter

  // G29 — selection toggles, scoped to the currently visible (filtered) rows.
  // toggleRow itself lives in useOutreachTargets; only the "select all visible" derivation stays local.
  const visibleIds = visibleTargets.map(tg => tg.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds))

  // Four UI states — never a blank panel.
  if (loading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.loading')}</p>
  if (error)   return <p style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('drawer.error')}</p>
  if (!targets.length) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.empty')}</p>


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* BELLIJST-SCALE-1 — search on name + client-side status/outcome/assignee
          filters over the already-loaded targets; makes a large call list usable
          without a backend change (Danny 2026-08-14). */}
      <TargetsFilterBar search={search} onSearch={setSearch}
        statusPick={statusPick} onStatusPick={setStatusPick}
        outcomePick={outcomePick} onOutcomePick={setOutcomePick}
        assigneePick={assigneePick} onAssigneePick={setAssigneePick}
        statusOptions={statuses.map(o => ({ value: o.value, label: o.label }))}
        outcomeOptions={outcomes.map(o => ({ value: o.value, label: o.label }))}
        assigneeOptions={assigneeOptions} hasLocalFilters={hasLocalFilters}
        onClearAll={() => { setSearch(''); setStatusPick(null); setOutcomePick(null); setAssigneePick(null) }} />

      {filter && <TargetsActiveFilterChip filter={filter} filterLabel={filterLabel} onClearFilter={onClearFilter} />}

      {onAssignTargets && visibleTargets.length > 0 && (
        <TargetsSelectionHeader assignAllFiltered={assignAllFiltered} setAssignAllFiltered={setAssignAllFiltered}
          currentFilters={currentFilters} visibleCount={visibleTargets.length}
          selected={selected} setSelected={setSelected} recruiters={recruiters} onAssignTargets={onAssignTargets}
          allSelected={allSelected} toggleAll={toggleAll} hasAnyFilter={hasAnyFilter} />
      )}
      {/* Visible-row count — how many of the (search/filter-narrowed) targets are
          on screen; AssignTargetsBar carries the separate "N geselecteerd" count. */}
      {visibleTargets.length > 0 && (
        <Caption style={{ padding: '0 4px' }}>
          {t('common:resultsCount', { count: visibleTargets.length })}
        </Caption>
      )}

      {visibleTargets.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.stats.noMatches')}</p>
      ) : visibleTargets.map(tg => (
        <TargetRow key={tg.id} tg={tg} statuses={statuses} metaOf={metaOf} initial={initial} outcomes={outcomes}
          selectable={!!onAssignTargets} isSelected={selected.has(tg.id)} onToggleRow={toggleRow}
          isExpanded={expanded.has(tg.id)} onToggleExpanded={toggleExpanded}
          onSetStatus={onSetStatus} onSetOutcome={onSetOutcome} onSetNote={onSetNote}
          campaignId={campaignId} onApplyTargetNote={onApplyTargetNote}
          onNewTask={setTaskFor} onStartMatch={target => { setMatchFor(target); setMatchVacancyId('') }}
          matchOpen={matchFor?.id === tg.id} matchVacancyId={matchVacancyId} setMatchVacancyId={setMatchVacancyId}
          vacancyOptions={vacancyOptions} matchSaving={matchSaving} confirmMatch={confirmMatch}
          onCancelMatch={() => setMatchFor(null)} />
      ))}

      {/* New task pre-linked to the row's candidate (shared modal). AddTaskModal reads
          useTaskLookups — outside TasksPage that provider is absent (live crash, Danny
          18-07, same fix as CandidateTasks), so it wraps its own here. */}
      {taskFor?.candidate?.id && (
        <TaskLookupsProvider>
          <AddTaskModal
            initial={{ candidateId: String(taskFor.candidate.id) }}
            onClose={() => setTaskFor(null)}
            onCreated={() => setTaskFor(null)}
          />
        </TaskLookupsProvider>
      )}
    </div>
  )
}
