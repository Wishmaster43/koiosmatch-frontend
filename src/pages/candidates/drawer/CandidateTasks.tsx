/**
 * CandidateTasks — the candidate's open tasks as a Communicatie sub-tab (Danny
 * 2026-07-03: "door wie, wanneer gemaakt, prio ect alles"). Each row shows title,
 * status + priority chips, due date, assignee and the created-by/at line; "+ Taak"
 * creates a task that is pre-linked to this candidate. Data via GET
 * /tasks?candidate={id} (TASKS-1).
 *
 * Row actions (Danny 20-07) mirror the Sollicitaties sub-tab pattern exactly: the
 * title is the shared `EntityLink` (name = in-app open via the nav context, its
 * trailing icon = the same record in a NEW BROWSER TAB via the #tasks?open={id}
 * deep link — both built into that one component, never hand-rolled here), and a
 * pencil at the row's bottom-right opens the shared modal in EDIT mode.
 *
 * AXIS-MATRIX-2 (CMFE audit R1): wires the shared action-rule preflight for
 * `task.create` (mirrors MatchModal's match.create). The actual create/
 * edit form is the shared AddTaskModal (owned outside this file's scope, reused by
 * every entity — never forked here), so this component is the only choke point
 * available to gate creation: a warn cell shows the banner but leaves "+ Taak"
 * enabled (proceed allowed, e.g. an administrative task on a blacklisted
 * candidate); a block cell (an archived candidate) additionally disables "+ Taak"
 * itself — the calm explanation replaces opening a modal whose submit would just 422.
 *
 * TOOLBAR (Danny live review, 04-08, revised same day: "taken is nog niet
 * goed" — the search + StatusFilterSelect first landed ALONGSIDE the old
 * Open/Historie toggles, which was double filtering). Final shape: search →
 * StatusFilterSelect → "+ Taak", ONE line, nothing else — byte-identical
 * toolbar shape to the shared `EntityTasksTab` (customer drill-down). The
 * Open/Historie toggles are GONE; their semantics fold into the status filter,
 * exactly like the customer-level tab: `useStatusFilter`'s default-guess only
 * proposes a value when a status's `value` matches 'active'/'actief'/'open'
 * (StatusFilterSelect.tsx's `isActiveValue`) — the REAL tenant seed
 * (TaskLookupSeeder.php: todo/in_progress/done) never does, so the customer tab's
 * OWN real-world default is "nothing picked = show every status, done included",
 * not "open only". Copied here exactly: no `tenantDefault` passed, same as
 * EntityTasksTab.
 *
 * Full `EntityTasksTab` adoption is still not the right call: it would drop the
 * AXIS-MATRIX-2 create-gate, the priority chip + created-by/at line, and the
 * in-place edit pencil (EntityTasksTab only navigates to the task, it doesn't
 * edit it) — all genuine behaviour this file keeps. So the toolbar SHAPE now
 * matches EntityTasksTab exactly; the row body and the create-gate stay this
 * file's own. The tenant task-status lookup (`useTaskLookups`) needs to be
 * available at all times (not just while a modal is open), so the component
 * wraps its whole body in `TaskLookupsProvider` once, top-level (mirrors
 * EntityTasksTab's own split), instead of the two separate wraps that used to
 * sit around just the add/edit modals.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, Pencil, Search } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import EntityLink from '@/components/ui/EntityLink'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import DrawerAddButton from './DrawerAddButton'
import { AddTaskModal } from '@/pages/tasks/shared'
import { TaskLookupsProvider, useTaskLookups } from '@/context/TaskLookupsContext'
import { useDateFormat } from '@/lib/datetime'
import { useActionRulePreflight, ActionRuleBanner } from '@/components/actionrules'
import type { Id } from '@/types/common'

// One task row as the API returns it — lookup fields arrive as objects or bare slugs.
interface TaskRow {
  id: Id; title?: string; due_date?: string | null; completed_at?: string | null; created_at?: string | null
  priority?: { value?: string; label?: string; color?: string } | string | null
  status?: { value?: string; label?: string; color?: string } | string | null
  assignee?: { id?: Id; name?: string } | string | null
  created_by?: { id?: Id; name?: string } | string | null
}

// Resolve a person field ("by whom / for whom") from either API shape.
const personName = (v: TaskRow['assignee']): string => (typeof v === 'object' ? v?.name : v) ?? ''

// The row's own status KEY (for the filter), resolved whether the API sent a
// lookup OBJECT ({value,label,color}) or a bare string — mirrors the shared
// EntityTasksTab's own reader so both filter the same tenant vocabulary the same way.
const statusKeyOf = (t: TaskRow): string => {
  const st = t.status as { value?: string } | string | null | undefined
  return String((typeof st === 'object' ? st?.value : st) ?? '')
}

// Wraps the tab body in the tenant task-status lookup provider — needed at ALL
// times now (the status filter reads it on every render), not just while the
// add/edit modal is mounted (the previous two separate wraps).
export default function CandidateTasks(props: { candidateId: Id }) {
  return (
    <TaskLookupsProvider>
      <CandidateTasksBody {...props} />
    </TaskLookupsProvider>
  )
}

function CandidateTasksBody({ candidateId }: { candidateId: Id }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const { statuses } = useTaskLookups()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(false)
  // The task being edited (pencil on a row) — set → the shared modal opens in edit mode.
  const [editingId, setEditingId] = useState<Id | null>(null)
  // Toolbar search (Danny live review, 04-08) — narrows on title + assignee, on
  // top of the status filter below. The old Open/Historie toggle is gone (see
  // file header) — its job is now the status filter's own value.
  const [search, setSearch] = useState('')

  // AXIS-MATRIX-2 preflight — see file header. block disables "+ Taak" itself.
  const { decision: taskRuleDecision } = useActionRulePreflight('task.create', { candidateId: String(candidateId || '') })
  const taskRuleBlocked = taskRuleDecision?.effect === 'block'

  // Load the candidate-linked tasks; a 404/422 (param not built yet) reads as empty, not broken.
  const load = useCallback(() => {
    setLoading(true); setError(false)
    api.get('/tasks', { params: { candidate: candidateId } })
      .then(r => setTasks((unwrapList(r).rows) as TaskRow[]))
      .catch(e => { if ([404, 422].includes(e?.response?.status)) setTasks([]); else setError(true) })
      .finally(() => setLoading(false))
  }, [candidateId])
  useEffect(() => { load() }, [load])

  // Priority/status chips arrive as lookup objects or bare strings — render defensively.
  const chip = (v: TaskRow['priority']) => {
    const label = typeof v === 'object' ? v?.label ?? v?.value : v
    const color = (typeof v === 'object' ? v?.color : null) ?? 'var(--text-muted)'
    if (!label) return null
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, color, whiteSpace: 'nowrap',
      background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}>{label}</span>
  }

  // Status filter (Danny live review, 04-08, final shape) — the tenant's real
  // task-status lookup REPLACES the old Open/Historie toggle entirely (see file
  // header): no tenantDefault passed, so nothing is selected until the user picks
  // one — same "show everything, done included" default the customer drill-down's
  // own EntityTasksTab has for the real (never 'active'/'open'-valued) tenant seed.
  const { value: statusFilter, toggle: toggleStatus, filtered: byStatus } =
    useStatusFilter(tasks, statuses, statusKeyOf)

  // Free-text search on top of the status filter — title + assignee, same idiom
  // as the shared EntityTasksTab / customer drill-down toolbar.
  const q = search.trim().toLowerCase()
  const visible = q ? byStatus.filter(x => [x.title, personName(x.assignee)].some(v => String(v ?? '').toLowerCase().includes(q))) : byStatus

  // Toolbar (Danny live review, 04-08, final shape): search (grows) → status
  // filter → "+ Taak", ONE line, nothing else — byte-identical shape to the
  // shared EntityTasksTab (customer drill-down), folded into this titleless
  // SectionCard header.
  const toolbar = (
    <span style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <Search size={13} color="var(--text-muted)" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('drawer.tasksSearchPlaceholder')} aria-label={t('drawer.tasksSearchPlaceholder')}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
      </span>
      <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={statuses} />
      {/* DRAWER-ADD-SHORT-1 (Danny 05-08): short — always inside the Communicatie →
          Taken sub-tab, never a full page. */}
      <DrawerAddButton onClick={() => setAdding(true)} disabled={taskRuleBlocked}
        title={taskRuleBlocked ? taskRuleDecision?.message ?? undefined : undefined}
        label={t('drawer.newTask')} short />
    </span>
  )

  return (
    // No title (Danny addendum 4): this only renders inside the Communicatie →
    // Taken sub-tab, whose bar already says "Taken" — the toolbar above stays on
    // this row, just without the repeated label.
    <SectionCard action={toolbar}>
      {/* AXIS-MATRIX-2 preflight — see file header comment. */}
      {taskRuleDecision && taskRuleDecision.effect !== 'allow' && (
        <div style={{ marginBottom: 10 }}><ActionRuleBanner decision={taskRuleDecision} /></div>
      )}
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.tasksLoading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('drawer.tasksError')}</div>}
      {!loading && !error && visible.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <ListChecks size={14} style={{ opacity: 0.6 }} /> {t('drawer.tasksEmpty')}
        </div>
      )}
      {!loading && !error && visible.map(task => {
        const assignee = personName(task.assignee)
        const creator  = personName(task.created_by)
        // Created line: "aangemaakt door X · date" — parts render only when the API delivers them.
        const createdLine = [
          creator ? t('drawer.taskCreatedBy', { name: creator }) : null,
          task.created_at ? formatDate(task.created_at) : null,
        ].filter(Boolean).join(' · ')
        return (
          // Plain row (not a button, Danny 20-07): the title's own EntityLink handles
          // in-app open + new-tab, and the pencil is a sibling action — mirrors the
          // Sollicitaties row (WorkTab), never a whole-row click target.
          <div key={task.id}
            style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '7px 10px', marginBottom: 6,
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <ListChecks size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500 }}>
                <EntityLink page="tasks" id={task.id} title={t('drawer.taskOpen')}>{task.title ?? '—'}</EntityLink>
              </span>
              {task.due_date && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(task.due_date)}</span>}
              {chip(task.status)}
              {chip(task.priority)}
            </span>
            {/* Meta line: for whom (assignee) + created by/at (the "alles" Danny asked
                for), and the edit pencil pinned bottom-right — always rendered so the
                pencil has one stable spot even on a row with no assignee/creator line. */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', paddingLeft: 21, flexWrap: 'wrap' }}>
              {assignee && <span>{t('drawer.taskFor', { name: assignee })}</span>}
              {assignee && createdLine && <span>·</span>}
              {createdLine && <span>{createdLine}</span>}
              <button onClick={() => setEditingId(task.id)} title={t('drawer.taskEdit')} aria-label={t('drawer.taskEdit')}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                <Pencil size={12} />
              </button>
            </span>
          </div>
        )
      })}
      {/* New task, pre-linked to this candidate; reload so the fresh row shows at once.
          The tenant lookup provider now wraps the whole tab (see the default export
          above), so this no longer needs its own wrap. */}
      {adding && (
        <AddTaskModal
          initial={{ candidateId: String(candidateId) }}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); load() }}
        />
      )}
      {/* Edit an existing task (pencil). */}
      {editingId != null && (
        <AddTaskModal
          editId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load() }}
        />
      )}
    </SectionCard>
  )
}
