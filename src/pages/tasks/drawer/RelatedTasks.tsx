/**
 * RelatedTasks — its own TASK DRAWER TAB (T5, was a section pinned under Details):
 * the other tasks of whichever record this task is linked to. Generalised beyond
 * candidate-only — the subject can be a candidate/customer/location/department/
 * contact link, or — when the task carries none of those — its own assignee (a
 * recruiter/user isn't a `links` row, it's `assignee_id`), so an assigned-but-
 * unlinked task still shows a meaningful "other tasks of this person" view. Behaves
 * like the tasks page: a free-text search + a filter menu, wired to the real
 * server-side /tasks filter params (TaskQuery::rules() — measured: one filter per
 * link-type token PLUS assignee_id[]/status[]/type[]/priority[]/q). Rows click
 * through to that task's own drawer. Renders nothing when the task carries no
 * qualifying subject.
 *
 * TASK-FILTER-MENU-1 (Danny 08-08, "Notities dus zo overal met die filter en ook
 * taken doen"): status + type + priority moved BEHIND the shared DrawerFilterMenu
 * (one "Filter" button, badge + panel — never removable chips under the toolbar,
 * see that component's own VISIBILITY CHOICE doc comment). Every row narrows the
 * SAME server-side params EntityTasksTab's client-side rows narrow client-side —
 * the two hosts differ in WHERE the filtering happens, not in what is offered.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import HeaderSearch from '@/components/ui/HeaderSearch'
import SoftChip from '@/components/ui/SoftChip'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { useNavigation } from '@/context/NavigationContext'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useDateFormat } from '@/lib/datetime'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface Row {
  id: Id; title?: string; due_date?: string | null; completed_at?: string | null
  status?: { label?: string; color?: string } | string | null
}

// Which of the task's OWN polymorphic link types qualify as "the subject" of this
// tab, in priority order (T5's scope) — every other link type (application/vacancy/
// match/opportunity/customer_location/workflow) is not a meaningful "whose other
// tasks" grouping and is skipped.
const ENTITY_LINK_TYPES = ['candidate', 'customer', 'location', 'department', 'contact'] as const
type EntityLinkType = typeof ENTITY_LINK_TYPES[number]
type SubjectType = EntityLinkType | 'assignee'

interface Subject { type: SubjectType; id: Id }

// The ONE entity this tab is about: the first qualifying link on the task, or —
// when none of those link types are present — the task's own assignee. Null when
// neither exists (mirrors the old "no candidate link" guard, generalised).
function resolveSubject(task: TaskDetail): Subject | null {
  for (const type of ENTITY_LINK_TYPES) {
    const link = (task.links ?? []).find(l => l.type === type && l.id != null)
    if (link) return { type, id: link.id as Id }
  }
  if (task.assigneeId != null) return { type: 'assignee', id: task.assigneeId }
  return null
}

// FIX 2 (esc-en-lege-tabs, "no empty tabs" — §3A): exported so TaskDrawer can
// decide whether to LIST this tab at all — this component itself already
// renders null when there is no subject (no add-affordance either, it is a
// read-only list), so an unconditional tab would show a blank pane. Single
// source of truth for "does this task have a qualifying subject" — never
// duplicate the ENTITY_LINK_TYPES walk in the drawer.
export function hasRelatedSubject(task: TaskDetail): boolean {
  return resolveSubject(task) !== null
}

export default function RelatedTasks({ task }: { task: TaskDetail }) {
  const { t } = useTranslation(['tasks', 'common'])
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const { statuses, types, priorities } = useTaskLookups()
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  // TASK-FILTER-MENU-1: type/priority — same server-side multi-select shape as status.
  const [selectedType, setSelectedType] = useState<string[]>([])
  const [selectedPriority, setSelectedPriority] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  // Freshness guard (§9, mirrors this drawer's own NotesTab.tsx): a monotonic
  // request id so a slow/older response can never overwrite a newer one — every
  // filter change (search/status) re-triggers this exact race risk.
  const requestIdRef = useRef(0)

  const subject = resolveSubject(task)

  // Load the subject's other tasks, server-filtered (search + status), own task
  // filtered out client-side. A failed load surfaces its OWN error state (mirrors
  // the tasks page's loading/error split and this drawer's own NotesTab.tsx retry).
  const fetchRelated = useCallback(() => {
    if (!subject) { setRows([]); setLoading(false); setError(false); return }
    const requestId = ++requestIdRef.current
    setLoading(true); setError(false)
    // Per-entity-type filter param (TaskQuery: one uuid filter per link-type token)
    // vs assignee_id[] (an array filter — the recruiter/user fallback subject).
    const params: Record<string, unknown> = subject.type === 'assignee'
      ? { assignee_id: [subject.id] }
      : { [subject.type]: subject.id }
    if (selectedStatus.length > 0) params.status = selectedStatus
    if (selectedType.length > 0) params.type = selectedType
    if (selectedPriority.length > 0) params.priority = selectedPriority
    if (query.trim()) params.q = query.trim()
    api.get('/tasks', { params })
      .then(r => { if (requestIdRef.current === requestId) setRows(((unwrapList(r).rows) as Row[]).filter(x => String(x.id) !== String(task.id))) })
      .catch(err => { if (requestIdRef.current === requestId && err?.response?.status !== 404) setError(true) })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false) })
    // `subject` is deliberately NOT a dep: resolveSubject(task) returns a fresh
    // object every render, so depending on it would re-fetch on every parent
    // re-render — its two primitive fields (type/id) are the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject?.type, subject?.id, selectedStatus, selectedType, selectedPriority, query, task.id])
  useEffect(() => { fetchRelated() }, [fetchRelated])

  if (!subject) return null

  // TASK-FILTER-MENU-1: status/type/priority — all server-side multi-select rows,
  // '' selection = "all". Type/priority only offered when the tenant lookup
  // actually has entries (no fake affordance, §3) — status always does (seed).
  const toggleStatus = (v: string) => setSelectedStatus(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  const toggleType = (v: string) => setSelectedType(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  const togglePriority = (v: string) => setSelectedPriority(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  const filterRows: DrawerFilterConfig[] = [
    { type: 'multi', key: 'status', label: t('cols.status'), selected: selectedStatus,
      options: statuses.map(s => ({ value: s.value, label: s.label })), onToggle: toggleStatus,
      searchPlaceholder: t('common:search'), noResultsLabel: t('common:noResults') },
    ...(types.length > 0 ? [{ type: 'multi' as const, key: 'type', label: t('cols.type'), selected: selectedType,
      options: types.map(ty => ({ value: ty.value, label: ty.label })), onToggle: toggleType,
      searchPlaceholder: t('common:search'), noResultsLabel: t('common:noResults') }] : []),
    ...(priorities.length > 0 ? [{ type: 'multi' as const, key: 'priority', label: t('cols.priority'), selected: selectedPriority,
      options: priorities.map(p => ({ value: p.value, label: p.label })), onToggle: togglePriority,
      searchPlaceholder: t('common:search'), noResultsLabel: t('common:noResults') }] : []),
  ]

  return (
    <div>
      {/* The right title per entity type (T5) — a fixed, per-type phrase (avoids
          de/het gender-agreement issues a single interpolated template would hit). */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        {t(`related.titles.${subject.type}`)}
      </div>

      {/* Search + filter menu — behaves like the tasks page (T5). TASK-FILTER-MENU-1:
          status/type/priority now live behind the one Filter button. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <HeaderSearch onSearch={setQuery} placeholder={t('related.searchPlaceholder')} width={200} />
        <DrawerFilterMenu filters={filterRows}
          label={t('common:filters.button', { defaultValue: 'Filter' })}
          title={t('common:filters.title')} clearAllLabel={t('common:filters.clearAll')} />
      </div>

      {/* Four UI states (§3): loading / error+retry / empty / success. */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('related.loading')}</div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger)' }}>
          <span>{t('related.error')}</span>
          <button onClick={fetchRelated} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '3px 9px', cursor: 'pointer', color: 'var(--text)' }}>{t('common:error.retry')}</button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('related.empty')}</div>
      ) : rows.map(r => {
        const st = r.status
        const label = typeof st === 'object' ? st?.label : st
        const color = (typeof st === 'object' ? st?.color : null) ?? 'var(--text-muted)'
        return (
          <button key={String(r.id)} onClick={() => openEntity('tasks', r.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 6,
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: 'pointer' }}>
            <ListChecks size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.title ?? '—'}
            </span>
            {(r.completed_at || r.due_date) && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(r.completed_at ?? r.due_date ?? undefined)}</span>
            )}
            {label && <SoftChip label={label} color={color} />}
          </button>
        )
      })}
    </div>
  )
}
