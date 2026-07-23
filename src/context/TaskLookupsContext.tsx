import { createContext, useContext, useState, useEffect } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import api, { unwrap } from '../lib/api'
import { sortActiveRows, makeMetaResolver } from '../lib/lookupUtils'

/**
 * TaskLookupsContext — the tenant-configurable task (activity) lookups.
 *
 * Mirrors VacancyLookupsContext (page-scoped, not app-wide): these lists are only
 * needed on the Tasks screen + its settings, so there is no global overhead. Each
 * list is a tenant-managed Settings lookup, never a hardcoded enum.
 *
 * Lists:
 *   statuses   — the board columns, single value + colour + `is_done`. `is_done`
 *                marks the "completed" column so KPIs (open/overdue/completed) never
 *                match the label "Afgerond" by hand.
 *   types      — activity type (Taak/Belafspraak/E-mail/Notitie).
 *   priorities — Laag · Normaal(is_default) · Hoog, with a colour.
 */

// One configurable task lookup row; statuses carry is_done, priorities is_default.
export interface TaskLookupItem { value: string; label: string; color: string; icon?: string; is_done?: boolean; is_default?: boolean; [k: string]: unknown }

interface TaskLookupsValue {
  statuses: TaskLookupItem[]
  types: TaskLookupItem[]
  priorities: TaskLookupItem[]
  loading: boolean
  statusMeta: (v?: string | null) => TaskLookupItem
  typeMeta: (v?: string | null) => TaskLookupItem
  priorityMeta: (v?: string | null) => TaskLookupItem
  doneStatusValues: string[]
  defaultPriority: string
}

// ── Seed defaults (English slugs, tenant-editable labels/colours) ─────────────

/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_TASK_STATUSES: TaskLookupItem[] = [
  { value: 'todo',        label: 'TeDoen',         color: '#D98A8A', is_done: false },
  { value: 'in_progress', label: 'In behandeling', color: '#DDA071', is_done: false },
  { value: 'done',        label: 'Afgerond',       color: '#79B58E', is_done: true },
]
/* eslint-enable no-restricted-syntax */

/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_TASK_TYPES: TaskLookupItem[] = [
  { value: 'task',  label: 'Taak',       color: '#6E8FD6' },
  { value: 'call',  label: 'Belafspraak', color: '#5FB0AC' },
  { value: 'email', label: 'E-mail',     color: '#A98AD1' },
  { value: 'note',  label: 'Notitie',    color: '#DDA071' },
]
/* eslint-enable no-restricted-syntax */

/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_TASK_PRIORITIES: TaskLookupItem[] = [
  { value: 'low',    label: 'Laag',    color: '#79B58E', is_default: false },
  { value: 'normal', label: 'Normaal', color: '#DDA071', is_default: true },
  { value: 'high',   label: 'Hoog',    color: '#D98A8A', is_default: false },
]
/* eslint-enable no-restricted-syntax */

// Tolerant truthy check — the backend may send a real bool, 1/0 or "true"/"false".
const truthy = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
// Carries `is_done` (statuses) and `is_default` (priorities) so the flags survive.
function normalize(raw: unknown, fallback: TaskLookupItem[]): TaskLookupItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return sortActiveRows(raw)
    .map(it => ({
      value: String(it.value ?? it.key ?? it.id),
      label: String(it.label ?? it.name ?? it.value ?? it.key),
      // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
      color: (it.color as string) ?? '#6B7280',
      is_done: truthy(it.is_done),
      is_default: truthy(it.is_default),
    }))
}

const TaskLookupsContext = createContext<TaskLookupsValue | null>(null)

export function TaskLookupsProvider({ children }: { children: ReactNode }) {
  const [statuses,   setStatuses]   = useState<TaskLookupItem[]>(DEFAULT_TASK_STATUSES)
  const [types,      setTypes]      = useState<TaskLookupItem[]>(DEFAULT_TASK_TYPES)
  const [priorities, setPriorities] = useState<TaskLookupItem[]>(DEFAULT_TASK_PRIORITIES)
  const [loading,    setLoading]    = useState(true)

  // Fetch each lookup once; a 404/empty keeps the seed fallback so the UI never breaks.
  useEffect(() => {
    const load = (url: string, fallback: TaskLookupItem[], set: Dispatch<SetStateAction<TaskLookupItem[]>>) =>
      api.get(url).then(r => set(normalize(unwrap(r), fallback))).catch(() => {})
    Promise.allSettled([
      load('/task-statuses',   DEFAULT_TASK_STATUSES,   setStatuses),
      load('/task-types',      DEFAULT_TASK_TYPES,      setTypes),
      load('/task-priorities', DEFAULT_TASK_PRIORITIES, setPriorities),
    ]).finally(() => setLoading(false))
  }, [])

  // The set of status keys that count as "completed" (for open/overdue/done KPIs).
  const doneStatusValues = statuses.filter(s => s.is_done).map(s => s.value)
  // The default priority key (seeded `is_default`), used to preselect in the modal.
  const defaultPriority = (priorities.find(p => p.is_default) ?? priorities[0])?.value ?? ''

  const value: TaskLookupsValue = {
    statuses, types, priorities, loading,
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    statusMeta:   makeMetaResolver(statuses, '#9CA3AF', { is_done: false }),
    typeMeta:     makeMetaResolver(types),
    priorityMeta: makeMetaResolver(priorities),
    doneStatusValues, defaultPriority,
  }

  return <TaskLookupsContext.Provider value={value}>{children}</TaskLookupsContext.Provider>
}

export function useTaskLookups(): TaskLookupsValue {
  const ctx = useContext(TaskLookupsContext)
  if (!ctx) throw new Error('useTaskLookups must be used within a TaskLookupsProvider')
  return ctx
}
