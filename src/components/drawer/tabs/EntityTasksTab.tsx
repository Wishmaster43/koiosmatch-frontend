/**
 * EntityTasksTab — the ONE "Taken" tab body for every drawer that shows the tasks
 * linked to one record (contact, opportunity, customer, …). Toolbar mirrors the
 * Vacatures tab (Danny 03-08: "moet eruitzien zoals Vacatures: zoeken — Alle
 * statussen — + Nieuwe taak") — search, a status filter, the house "+ Nieuwe taak"
 * trigger, all four UI states, and rows that click through to the task itself.
 *
 * TAKEN-TOOLBAR-2 (this task): the old Open/Historie QuickViewToggle switch is
 * replaced by the shared StatusFilterSelect, keyed on the tenant's real task-status
 * lookup (never a literal open/history split) — "Alle statussen" (nothing picked)
 * shows every task, completed included, same as every other status-filtered list.
 *
 * The status chip's colour respects `customer_task_table_color_status` (Settings →
 * Klanten → Weergave → Taken) when this tab renders inside the customer drawer —
 * see the `colorStatus` comment below for why it is scoped to that one linkType.
 *
 * Promoted out of pages/opportunities/drawer/TasksTab.tsx (§3A/§11 — a second copy
 * was about to be written for the contact drawer). Data comes from the generic
 * useEntityTasks(linkType, id) hook, so a new entity is one <EntityTasksTab
 * linkType="…"> line, never a new component.
 *
 * Labels arrive as a `labels` prop rather than a fixed namespace: this component is
 * shared across features that each own their own i18n namespace (mirrors the shared
 * NotesTab, which takes its labels the same way). Every string still comes from
 * t() at the call site — nothing is hardcoded here.
 */
import { useState } from 'react'
import { ListChecks, AlertTriangle, Search } from 'lucide-react'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import AddTaskModal from '@/pages/tasks/AddTaskModal'
import { TaskLookupsProvider, useTaskLookups } from '@/context/TaskLookupsContext'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import { useEntityTasks } from '@/hooks/useEntityTasks'
import type { EntityTask } from '@/hooks/useEntityTasks'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Id } from '@/types/common'

export interface EntityTasksLabels {
  newTask: string
  /** Placeholder for the toolbar search input (mirrors the Afdelingen toolbar). */
  searchPlaceholder: string
  empty: string
  loading: string
  error: string
  openTask: string
}

interface Props {
  /** The task-link token this record is: contact | opportunity | customer | … */
  linkType: string
  id: Id | undefined
  labels: EntityTasksLabels
  /** Optional extra links stamped on a task created from here (e.g. also link the customer). */
  extraLinks?: Array<{ type: string; id: string }>
}

// A task row's own status, resolved whether the API sent a lookup OBJECT
// ({value,label,color}) or a bare string — same tolerant read the row render below uses.
const statusKeyOf = (t: EntityTask): string => {
  const st = t.status as { value?: string } | string | null | undefined
  return String((typeof st === 'object' ? st?.value : st) ?? '')
}

// Wraps the tab body in the tenant task-status lookup provider. TaskLookupsProvider
// is only otherwise mounted around the Tasks PAGE (and, before this change, briefly
// around the "+ Nieuwe taak" modal here) — every OTHER host this shared tab renders
// inside (customer/contact/opportunity drawers) has no such provider above it, so
// the status filter below would have nothing to read (mirrors VacanciesTab's own
// workaround for the exact same problem with /vacancy-statuses).
export default function EntityTasksTab(props: Props) {
  return (
    <TaskLookupsProvider>
      <EntityTasksTabBody {...props} />
    </TaskLookupsProvider>
  )
}

function EntityTasksTabBody({ linkType, id, labels, extraLinks = [] }: Props) {
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const { items, loading, error, reload } = useEntityTasks(linkType, id)
  const { statuses } = useTaskLookups()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  // Status filter — replaces the old Open/Historie switch. Nothing selected = "Alle
  // statussen" = every task, completed included (never a hardcoded open/history split).
  const { value: statusFilter, toggle: toggleStatus, filtered: byStatus } =
    useStatusFilter(items, statuses, statusKeyOf)

  // Search narrows on title + owner, client-side — same idiom as the panel searches.
  const q = search.trim().toLowerCase()
  const visible = q ? byStatus.filter(x => [x.title, x.owner_name].some(v => String(v ?? '').toLowerCase().includes(q))) : byStatus

  // Status-chip colour toggle (CHIPKLEUR-INSTELBAAR-1 pattern, Settings → Klanten →
  // Weergave → Taken). Only wired for the customer embedding today — this shared tab
  // has no equivalent per-entity settings surface yet for its other callers (contact/
  // opportunity drawers), so default true keeps every existing embedding's
  // always-coloured look unchanged until a tenant explicitly turns it off here.
  const settings = useAllSettings()
  const colorStatus = linkType === 'customer' ? getBoolSetting(settings, 'customer_task_table_color_status', true) : true

  return (
    <div>
      {/* Toolbar mirrors the Vacatures tab (Danny 03-08): search left, the status
          filter middle, add right. The search markup copies DepartmentsPanel's
          verbatim (§11 debt noted there). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={labels.searchPlaceholder} aria-label={labels.searchPlaceholder}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={statuses} />
        <DrawerAddButton onClick={() => setAdding(true)} label={labels.newTask} />
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.loading}</div>}
      {!loading && error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={14} /> {labels.error}
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
          <ListChecks size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 12 }}>{labels.empty}</span>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((task, i) => {
            // The API sends `status` as a lookup OBJECT ({value,label,color}); older
            // payloads sent a bare string — resolve both, never render the object raw.
            const st = task.status as { label?: string; value?: string; color?: string } | string | null | undefined
            const statusLabel = task.status_label ?? (typeof st === 'object' ? st?.label ?? st?.value : st)
            const statusColor = task.status_color || (typeof st === 'object' ? st?.color : null) || 'var(--text-muted)'
            const due = (task.completed_at ?? task.due_at ?? task.due_date) as string | null | undefined
            return (
              <button key={String(task.id ?? i)} type="button" title={labels.openTask}
                onClick={() => task.id != null && openEntity('tasks', task.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px',
                  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{task.title || '—'}</div>
                  {(task.owner_name || due) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {[task.owner_name, due ? formatDate(due) : null].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                {statusLabel && (
                  colorStatus ? (
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                      background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, color: statusColor,
                      border: `1px solid color-mix(in srgb, ${statusColor} 40%, transparent)` }}>
                      {statusLabel}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', flexShrink: 0 }}>{statusLabel}</span>
                  )
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* New task pre-linked to this record; reload so the fresh row shows at once.
          AddTaskModal reads useTaskLookups — the top-level wrapper above now provides
          it for the whole tab (it used to wrap only this modal, Danny 18-07's original
          crash fix; the status filter needs the same provider, so it moved up). */}
      {adding && id != null && (
        <AddTaskModal
          extraLinks={[{ type: linkType, id: String(id) }, ...extraLinks]}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); reload() }}
        />
      )}
    </div>
  )
}
