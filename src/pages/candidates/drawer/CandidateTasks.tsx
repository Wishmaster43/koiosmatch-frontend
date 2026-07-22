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
 * `task.create` (mirrors MatchPlacementModal's match.create). The actual create/
 * edit form is the shared AddTaskModal (owned outside this file's scope, reused by
 * every entity — never forked here), so this component is the only choke point
 * available to gate creation: a warn cell shows the banner but leaves "+ Taak"
 * enabled (proceed allowed, e.g. an administrative task on a blacklisted
 * candidate); a block cell (an archived candidate) additionally disables "+ Taak"
 * itself — the calm explanation replaces opening a modal whose submit would just 422.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, Pencil } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import EntityLink from '@/components/ui/EntityLink'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import DrawerAddButton from './DrawerAddButton'
import AddTaskModal from '@/pages/tasks/AddTaskModal'
import { TaskLookupsProvider } from '@/context/TaskLookupsContext'
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

export default function CandidateTasks({ candidateId }: { candidateId: Id }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(false)
  // The task being edited (pencil on a row) — set → the shared modal opens in edit mode.
  const [editingId, setEditingId] = useState<Id | null>(null)
  // Open vs Historie (Danny 2026-07-04: "tabje history met alle oude taken").
  const [view, setView] = useState<'open' | 'history'>('open')

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

  // The rendered list follows the sub-view: open tasks vs the completed history.
  const visible = tasks.filter(x => (view === 'open' ? !x.completed_at : !!x.completed_at))

  // Header: Open/Historie sub-toggle (shared QuickViewToggle, §4 — never a
  // hand-rolled per-page pill) + "+ Taak" (shared task modal, pre-linked).
  // Chips left, +knop rechts (Danny 20-07) — full-width action row in the
  // titleless SectionCard header.
  const addAction = (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <QuickViewToggle active={view === 'open'} onToggle={() => setView('open')} label={t('drawer.tasksOpen')} />
        <QuickViewToggle active={view === 'history'} onToggle={() => setView('history')} label={t('drawer.tasksHistory')} />
      </span>
      <DrawerAddButton onClick={() => setAdding(true)} disabled={taskRuleBlocked}
        title={taskRuleBlocked ? taskRuleDecision?.message ?? undefined : undefined}
        label={t('drawer.newTask')} />
    </span>
  )

  return (
    // No title (Danny addendum 4): this only renders inside the Communicatie →
    // Taken sub-tab, whose bar already says "Taken" — the Open/Historie toggle +
    // "+ Taak" action stays on this row, just without the repeated label.
    <SectionCard action={addAction}>
      {/* AXIS-MATRIX-2 preflight — see file header comment. */}
      {taskRuleDecision && taskRuleDecision.effect !== 'allow' && (
        <div style={{ marginBottom: 10 }}><ActionRuleBanner decision={taskRuleDecision} /></div>
      )}
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.tasksLoading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.tasksError')}</div>}
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
          AddTaskModal reads useTaskLookups — outside TasksPage that provider is absent
          (live crash, Danny 18-07), so it wraps its own here. */}
      {adding && (
        <TaskLookupsProvider>
          <AddTaskModal
            initial={{ candidateId: String(candidateId) }}
            onClose={() => setAdding(false)}
            onCreated={() => { setAdding(false); load() }}
          />
        </TaskLookupsProvider>
      )}
      {/* Edit an existing task (pencil) — same provider-wrap requirement as "+ Taak". */}
      {editingId != null && (
        <TaskLookupsProvider>
          <AddTaskModal
            editId={editingId}
            onClose={() => setEditingId(null)}
            onSaved={() => { setEditingId(null); load() }}
          />
        </TaskLookupsProvider>
      )}
    </SectionCard>
  )
}
