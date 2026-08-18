/**
 * TargetsTab — the call list itself: one COMPACT row per target (candidate) with
 * a status soft-chip, quick check-off actions and — once handled — the call
 * OUTCOME (Danny 2026-07-04): outcome chips from the /outreach-outcomes lookup +
 * follow-ups (new task pre-linked to the candidate · create a match on a
 * vacancy), tucked behind a per-row expand toggle so large lists stay scannable
 * (BELLIJST-SCALE-1, Danny 2026-08-14: "hoe moet een eindgebruiker de
 * onderliggende 400 kandidaten per persoon selecteren?"). A name/status/outcome/
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
import { Phone, X, RotateCcw, ListChecks, Handshake, FilterX, ChevronDown, ChevronRight, Search } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import CandidateStatusChip from '@/components/ui/CandidateStatusChip'
// G34: the house searchable dropdown replaces the native vacancy <select>.
import CreatableSelect from '@/components/ui/CreatableSelect'
import AddTaskModal from '@/pages/tasks/AddTaskModal'
import { TaskLookupsProvider } from '@/context/TaskLookupsContext'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { initialsOf } from '@/lib/initials'
import { useDateFormat } from '@/lib/datetime'
import { useNavigation } from '@/context/NavigationContext'
import { useOutreachOutcomes } from '@/lib/useOutreachOutcomes'
import { useOutreachStatuses } from '@/lib/useOutreachStatuses'
import { useVacancyOptions } from '@/pages/candidates/hooks/useVacancyOptions'
import AssignTargetsBar from './AssignTargetsBar'
import TargetNoteField from './TargetNoteField'
import type { OutreachTarget, AssignResult } from '../hooks/useOutreachDetail'
import type { TargetSelection, AssigneeAxes } from '../data/outreachApi'
import type { TargetFilter } from './targetFilter'
import Button from '@/components/ui/Button'

interface RecruiterOption { value: string; label: string }

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
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const { outcomes } = useOutreachOutcomes()
  // Entry statuses from the tenant lookup (R-1b) — the is_reached FLAG drives
  // behaviour, so tenant-added statuses appear here without any code change.
  const { statuses, metaOf, initial } = useOutreachStatuses()
  // Per-row follow-up state: which target has the task modal / match prompt open.
  const [taskFor,  setTaskFor]  = useState<OutreachTarget | null>(null)
  const [matchFor, setMatchFor] = useState<OutreachTarget | null>(null)
  const [matchVacancyId, setMatchVacancyId] = useState('')
  const [matchSaving, setMatchSaving] = useState(false)
  // G29 — row selection feeding AssignTargetsBar; cleared once an assign settles.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // BELLIJST-ASSIGN-2: "assign everyone matching the current filter" — a second
  // entry point into AssignTargetsBar that sends `filters` instead of `ids`, so a
  // filtered set larger than the loaded page (a filter is server-unaware today,
  // client-side over what's loaded, but the SAME axis values the backend's own
  // filter vocabulary understands) can be divided without ticking every row.
  const [assignAllFiltered, setAssignAllFiltered] = useState(false)
  // Vacancy options only load while the match prompt is open.
  const vacancyOptions = useVacancyOptions(!!matchFor)
  // BELLIJST-SCALE-1 — rows expanded to show outcome/note; collapsed by default
  // so a 400-row list stays a scannable list, not 400 open cards.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpanded = (id: string) => setExpanded(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
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

  const candidateName = (tg: OutreachTarget) =>
    tg.candidate?.name ?? [tg.candidate?.first_name, tg.candidate?.last_name].filter(Boolean).join(' ') ?? '—'

  // Create the match via the canonical direct-match endpoint (G-2, mirrors useCreateMatch).
  const confirmMatch = async () => {
    if (!matchFor?.candidate?.id || !matchVacancyId) return
    setMatchSaving(true)
    try {
      await api.post('/matches', { candidate_id: matchFor.candidate.id, vacancy_id: matchVacancyId })
      notifySuccess(t('drawer.matchCreated'))
      setMatchFor(null); setMatchVacancyId('')
    } catch {
      notifyError(t('drawer.matchFailed'))
    } finally { setMatchSaving(false) }
  }

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
  const visibleIds = visibleTargets.map(tg => tg.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const toggleRow = (id: string) => setSelected(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds))

  // Four UI states — never a blank panel.
  if (loading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.loading')}</p>
  if (error)   return <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.error')}</p>
  if (!targets.length) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.empty')}</p>

  const actBtn = (title: string, onClick: () => void, icon: React.ReactNode, color: string, key?: string) => (
    <button key={key} onClick={onClick} title={title} aria-label={title}
      style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, cursor: 'pointer', color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      {icon}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* BELLIJST-SCALE-1 — search on name + client-side status/outcome/assignee
          filters over the already-loaded targets; makes a large call list usable
          without a backend change (Danny 2026-08-14). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common:search')}
            aria-label={t('common:search')}
            style={{ width: '100%', padding: '5px 8px 5px 26px', fontSize: 12, borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
        </div>
        <div style={{ width: 150 }}>
          <CreatableSelect value={statusPick} onChange={setStatusPick} allowCreate={false} clearable
            placeholder={t('drawer.stats.byStatus')}
            options={statuses.map(o => ({ value: o.value, label: o.label }))}
            style={{ padding: '5px 8px', fontSize: 12 }} />
        </div>
        <div style={{ width: 150 }}>
          <CreatableSelect value={outcomePick} onChange={setOutcomePick} allowCreate={false} clearable
            placeholder={t('drawer.stats.byOutcome')}
            options={outcomes.map(o => ({ value: o.value, label: o.label }))}
            style={{ padding: '5px 8px', fontSize: 12 }} />
        </div>
        <div style={{ width: 170 }}>
          <CreatableSelect value={assigneePick} onChange={setAssigneePick} allowCreate={false} clearable
            placeholder={t('drawer.stats.byAssignee')}
            options={assigneeOptions}
            style={{ padding: '5px 8px', fontSize: 12 }} />
        </div>
        {hasLocalFilters && (
          <button onClick={() => { setSearch(''); setStatusPick(null); setOutcomePick(null); setAssigneePick(null) }}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
            {t('common:filters.clearAll')}
          </button>
        )}
      </div>

      {/* G31 — active Stats-tab filter chip: visible on this tab too, since the
          filter narrows THIS list while the click that set it lives elsewhere. */}
      {filter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', fontSize: 11,
          borderRadius: 7, color: 'var(--color-primary-text)', background: 'var(--color-primary-bg)',
          border: '1px solid var(--color-primary)', width: 'fit-content' }}>
          <span>{t('drawer.stats.filteredBy', { axis: filterLabel, value: filter.value })}</span>
          <button onClick={onClearFilter} title={t('insights.clearFilter')} aria-label={t('insights.clearFilter')}
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
            <FilterX size={12} />
          </button>
        </div>
      )}

      {/* BELLIJST-ASSIGN-2 — select-all + count header, plus the "assign everyone
          matching this filter" entry point (sends `filters`, no ids form
          reachable) once ≥1 filter narrows the list; only meaningful once there
          is a real bulk action (assign) to consume the selection. */}
      {onAssignTargets && visibleTargets.length > 0 && (
        assignAllFiltered ? (
          <AssignTargetsBar selection={{ filters: currentFilters }} count={visibleTargets.length}
            recruiters={recruiters} onAssign={onAssignTargets} onDone={() => setAssignAllFiltered(false)} />
        ) : selected.size > 0 ? (
          <AssignTargetsBar selection={{ ids: [...selected] }} count={selected.size}
            recruiters={recruiters} onAssign={onAssignTargets} onDone={() => setSelected(new Set())} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} aria-label={t('common:selectAll')} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('common:selectAll')}</span>
            </div>
            {hasAnyFilter && (
              <button onClick={() => setAssignAllFiltered(true)}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0 }}>
                {t('drawer.assign.assignAllMatching', { count: visibleTargets.length })}
              </button>
            )}
          </div>
        )
      )}
      {/* Visible-row count — how many of the (search/filter-narrowed) targets are
          on screen; AssignTargetsBar carries the separate "N geselecteerd" count. */}
      {visibleTargets.length > 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 4px' }}>
          {t('common:resultsCount', { count: visibleTargets.length })}
        </span>
      )}

      {visibleTargets.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.stats.noMatches')}</p>
      ) : visibleTargets.map(tg => {
        const st   = tg.status ?? initial?.value ?? 'todo'
        const meta = metaOf(st)
        const col  = meta?.color ?? 'var(--text-muted)'
        const handled = st !== (initial?.value ?? 'todo')
        return (
          <div key={tg.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px',
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {onAssignTargets && (
                <input type="checkbox" checked={selected.has(tg.id)} onChange={() => toggleRow(tg.id)}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-primary)', flexShrink: 0 }} aria-label={t('common:selectRow')} />
              )}
              <Avatar initials={initialsOf(candidateName(tg))} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name → jump to the candidate drawer (cross-entity intent) + the shared
                    deployability chip (C-CHIP) — it handles Lead→dash and lookup colours. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <button onClick={() => tg.candidate?.id && openEntity('candidates', tg.candidate.id)}
                    title={t('drawer.action.openCandidate')}
                    style={{ display: 'block', minWidth: 0, padding: 0, background: 'none', border: 'none', cursor: tg.candidate?.id ? 'pointer' : 'default',
                      fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                    {candidateName(tg)}
                  </button>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>
                    <CandidateStatusChip status={tg.candidate?.status} phase={tg.candidate?.phase} />
                  </span>
                </div>
                {/* BELLIJST-SCALE-1 — contacted date + assignee on one muted line,
                    so the row stays a single compact line, not a small card. */}
                {(tg.contacted_at || tg.assignee?.name) && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tg.contacted_at && formatDate(tg.contacted_at)}
                    {tg.contacted_at && tg.assignee?.name && ' · '}
                    {tg.assignee?.name && t('drawer.assign.assignedTo', { name: tg.assignee.name })}
                  </div>
                )}
              </div>
              {/* Status soft-chip */}
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, color: col,
                background: `color-mix(in srgb, ${col} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 35%, transparent)` }}>
                {meta?.label ?? t(`drawer.target.${st}`, { defaultValue: st })}
              </span>
              {/* Quick check-off: contacted / answered / skipped; done rows can reset to todo. */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {!handled ? (
                  <>
                    {statuses.filter(o => o.value !== (initial?.value ?? 'todo')).map(o =>
                      actBtn(o.label, () => onSetStatus(tg.id, o.value),
                        o.is_reached ? <Phone size={12} /> : <X size={12} />, o.color ?? 'var(--color-primary)', o.value))}
                  </>
                ) : (
                  <>
                    {actBtn(t('drawer.action.newTask'),   () => setTaskFor(tg), <ListChecks size={12} />, 'var(--color-primary)')}
                    {actBtn(t('drawer.action.makeMatch'), () => { setMatchFor(tg); setMatchVacancyId('') }, <Handshake size={12} />, 'var(--color-success)')}
                    {actBtn(t('drawer.action.reset'),     () => onSetStatus(tg.id, initial?.value ?? 'todo'), <RotateCcw size={12} />, 'var(--text-muted)')}
                  </>
                )}
              </div>
              {/* BELLIJST-SCALE-1 — expand toggle: outcome chips + note stay tucked
                  away so a long list reads as one line per candidate by default. */}
              {(handled || onSetNote) && (
                <button onClick={() => toggleExpanded(tg.id)} title={t('common:clickForDetails')}
                  aria-label={t('common:clickForDetails')} aria-expanded={expanded.has(tg.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
                    flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {expanded.has(tg.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
            </div>

            {/* Outcome chips — record HOW the call ended (lookup-driven; click again to clear). */}
            {handled && expanded.has(tg.id) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 36 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('drawer.outcomeLabel')}</span>
                {outcomes.map(o => {
                  const active = tg.outcome === o.value
                  const oc = o.color ?? 'var(--color-primary)'
                  return (
                    <button key={o.value} onClick={() => onSetOutcome(tg.id, active ? null : o.value)}
                      style={{ padding: '2px 9px', fontSize: 10, fontWeight: active ? 600 : 500, borderRadius: 99, cursor: 'pointer',
                        color: oc, background: `color-mix(in srgb, ${oc} ${active ? 16 : 8}%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${oc} ${active ? 50 : 28}%, transparent)` }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* G30 — per-target note; hidden when the caller doesn't wire persistence
                (no fake affordance — §3), and tucked behind the same expand toggle. */}
            {onSetNote && expanded.has(tg.id) && (
              <div style={{ paddingLeft: 36 }}>
                <TargetNoteField note={tg.note} onSave={(note) => onSetNote(tg.id, note)}
                  targetId={tg.id} campaignId={campaignId}
                  onNoteSavedElsewhere={onApplyTargetNote ? (note) => onApplyTargetNote(tg.id, note) : undefined} />
              </div>
            )}

            {/* Inline match prompt for THIS row: pick a vacancy → POST /matches. */}
            {matchFor?.id === tg.id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 36 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CreatableSelect value={matchVacancyId || null} onChange={setMatchVacancyId} allowCreate={false} clearable
                    placeholder={t('drawer.matchPick')}
                    options={vacancyOptions.map(v => ({ value: String(v.value), label: v.label + (v.client ? ` — ${v.client}` : '') }))}
                    style={{ padding: '6px 8px', fontSize: 12 }} />
                </div>
                <Button variant="primary" size="sm" onClick={confirmMatch} disabled={!matchVacancyId || matchSaving}>
                  {t('drawer.matchConfirm')}
                </Button>
                <button onClick={() => setMatchFor(null)} title={t('common:cancel')} aria-label={t('common:cancel')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )
      })}

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
