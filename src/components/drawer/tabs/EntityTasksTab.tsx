/**
 * EntityTasksTab — the ONE "Taken" tab body for every drawer that shows the tasks
 * linked to one record (contact, opportunity, customer, …). Toolbar mirrors the
 * Vacatures tab (Danny 03-08: "moet eruitzien zoals Vacatures: zoeken — Alle
 * statussen — + Nieuwe taak") — search, a status filter, the house "+ Nieuwe taak"
 * trigger, all four UI states, and rows that click through to the task itself.
 *
 * TAKEN-TOOLBAR-2: the old Open/Historie QuickViewToggle switch was replaced by a
 * multi-select status filter keyed on the tenant's real task-status lookup (never a
 * literal open/history split) — "Alle statussen" (nothing picked) shows every task,
 * completed included, same as every other status-filtered list. It now lives inside
 * DrawerFilterMenu (TASK-FILTER-MENU-1 below) rather than the standalone
 * StatusFilterSelect trigger — this file still reuses that component's
 * `useStatusFilter` hook for the actual filtering logic, just not its UI.
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
 *
 * TASK-FILTER-MENU-1 (Danny 08-08, "Notities dus zo overal met die filter en ook
 * taken doen"): status + the tenant TYPE ("Soort activiteit") and PRIORITY lookups
 * moved BEHIND the shared DrawerFilterMenu (search + add stay in the toolbar), all
 * as MULTI-select rows (mirrors useStatusFilter's own multi-value contract).
 * `type`/`priority` field labels come straight from the 'tasks' namespace, not the
 * `labels` prop: they are TASK-domain vocabulary, identical for every host this tab
 * renders inside — exactly the same namespace AddTaskModal (rendered by this same
 * tab) already uses regardless of caller. The generic filter-chrome copy (button/
 * panel-title/clear-all) comes from 'common', mirroring NotesTab/DocumentsSection.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, AlertTriangle, Search } from 'lucide-react'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { AddTaskModal } from '@/pages/tasks/shared'
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
// TASK-FILTER-MENU-1: same tolerant object-or-string read for type/priority — the
// TaskListResource sends both as {value,label,color} lookup objects (mirrors status).
const typeKeyOf = (t: EntityTask): string => {
  const v = t.type as { value?: string } | string | null | undefined
  return String((typeof v === 'object' ? v?.value : v) ?? '')
}
const priorityKeyOf = (t: EntityTask): string => {
  const v = t.priority as { value?: string } | string | null | undefined
  return String((typeof v === 'object' ? v?.value : v) ?? '')
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

// The actual tab body, rendered inside its own TaskLookupsProvider (see the wrapper
// above) so the status filter always has a lookup to read from.
function EntityTasksTabBody({ linkType, id, labels, extraLinks = [] }: Props) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const { items, loading, error, reload } = useEntityTasks(linkType, id)
  const { statuses, types, priorities } = useTaskLookups()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  // Status filter — replaces the old Open/Historie switch. Nothing selected = "Alle
  // statussen" = every task, completed included (never a hardcoded open/history split).
  const { value: statusFilter, toggle: toggleStatus, filtered: byStatus } =
    useStatusFilter(items, statuses, statusKeyOf)
  // TASK-FILTER-MENU-1: type ("Soort activiteit") + priority — same multi-select
  // shape as status, client-side over the already-loaded `items` (mirrors the
  // status filter exactly; no new API params).
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const toggleType = (v: string) => setTypeFilter(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  const togglePriority = (v: string) => setPriorityFilter(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  const byType = typeFilter.length === 0 ? byStatus : byStatus.filter(x => typeFilter.includes(typeKeyOf(x)))
  const byPriority = priorityFilter.length === 0 ? byType : byType.filter(x => priorityFilter.includes(priorityKeyOf(x)))

  // Search narrows on title + owner, client-side — same idiom as the panel searches.
  const q = search.trim().toLowerCase()
  const visible = q ? byPriority.filter(x => [x.title, x.owner_name].some(v => String(v ?? '').toLowerCase().includes(q))) : byPriority

  // TASK-FILTER-MENU-1: the DrawerFilterMenu rows — status always offered (the
  // lookup always carries the seed fallback), type/priority only when the tenant
  // actually has entries (no fake affordance, §3).
  const filterRows: DrawerFilterConfig[] = [
    { type: 'multi', key: 'status', label: t('cols.status'), selected: statusFilter,
      options: statuses.map(s => ({ value: s.value, label: s.label })), onToggle: toggleStatus,
      searchPlaceholder: t('common:search'), noResultsLabel: t('common:noResults') },
    ...(types.length > 0 ? [{ type: 'multi' as const, key: 'type', label: t('cols.type'), selected: typeFilter,
      options: types.map(ty => ({ value: ty.value, label: ty.label })), onToggle: toggleType,
      searchPlaceholder: t('common:search'), noResultsLabel: t('common:noResults') }] : []),
    ...(priorities.length > 0 ? [{ type: 'multi' as const, key: 'priority', label: t('cols.priority'), selected: priorityFilter,
      options: priorities.map(p => ({ value: p.value, label: p.label })), onToggle: togglePriority,
      searchPlaceholder: t('common:search'), noResultsLabel: t('common:noResults') }] : []),
  ]

  // Status-chip colour toggle (CHIPKLEUR-INSTELBAAR-1 pattern, Settings → Klanten →
  // Weergave → Taken). Only wired for the customer embedding today — this shared tab
  // has no equivalent per-entity settings surface yet for its other callers (contact/
  // opportunity drawers), so default true keeps every existing embedding's
  // always-coloured look unchanged until a tenant explicitly turns it off here.
  const settings = useAllSettings()
  const colorStatus = linkType === 'customer' ? getBoolSetting(settings, 'customer_task_table_color_status', true) : true

  return (
    <div>
      {/* Toolbar mirrors the Vacatures tab (Danny 03-08): search left, the filter
          button middle, add right. The search markup copies DepartmentsPanel's
          verbatim (§11 debt noted there). TASK-FILTER-MENU-1: status/type/priority
          now live BEHIND the one compact Filter button instead of a standing
          StatusFilterSelect trigger. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={labels.searchPlaceholder} aria-label={labels.searchPlaceholder}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <DrawerFilterMenu filters={filterRows}
          label={t('common:filters.button', { defaultValue: 'Filter' })}
          title={t('common:filters.title')} clearAllLabel={t('common:filters.clearAll')} />
        {/* DRAWER-ADD-SHORT-1 (Danny 05-08): short — this tab always lives inside a
            drawer sub-tab, never a full page. */}
        <DrawerAddButton onClick={() => setAdding(true)} label={labels.newTask} short />
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.loading}</div>}
      {!loading && error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger-text)' }}>
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
            // Prefer the LIVE tenant lookup (statuses, from useTaskLookups) over the
            // raw payload — a status renamed/recoloured in Settings after the task's
            // row was written must show the current label/colour, not a stale snapshot.
            const liveStatus = statuses.find(s => s.value === statusKeyOf(task))
            const st = task.status as { label?: string; value?: string; color?: string } | string | null | undefined
            const statusLabel = liveStatus?.label ?? task.status_label ?? (typeof st === 'object' ? st?.label ?? st?.value : st)
            const statusColor = liveStatus?.color || task.status_color || (typeof st === 'object' ? st?.color : null) || 'var(--text-muted)'
            const due = (task.completed_at ?? task.due_at ?? task.due_date) as string | null | undefined
            return (
              <button key={String(task.id ?? i)} type="button" title={labels.openTask}
                onClick={() => task.id != null && openEntity('tasks', task.id)}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width clickable list row (structural, not an action button), pre-existing and out of this ink/tint task's scope
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
                    // Tint via lib/tint (house pair); ink via chipInk — the raw lookup
                    // colour on its own tint reads 2.4-3.0:1, AA fail (herhaal-slotaudit r3.5).
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                      background: tintBg(statusColor), color: chipInk(statusColor),
                      border: tintBorder(statusColor) }}>
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
