import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { COOKIE_AUTH } from '../lib/authMode'

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
 *                match the label "Afgerond" by hand. Seed: TeDoen · In behandeling ·
 *                Afgerond(is_done).
 *   types      — activity type (Taak/Belafspraak/E-mail/Notitie).
 *   priorities — Laag · Normaal(is_default) · Hoog, with a colour.
 *
 * The defaults below are the seed shipped for new tenants and the fallback while
 * the API call is in flight / before the backend is ready (see worklist C-18).
 */

// ── Seed defaults (English slugs, tenant-editable labels/colours) ─────────────

const DEFAULT_TASK_STATUSES = [
  { value: 'todo',        label: 'TeDoen',         color: '#D98A8A', is_done: false },
  { value: 'in_progress', label: 'In behandeling', color: '#DDA071', is_done: false },
  { value: 'done',        label: 'Afgerond',       color: '#79B58E', is_done: true },
]

const DEFAULT_TASK_TYPES = [
  { value: 'task',  label: 'Taak',       color: '#6E8FD6' },
  { value: 'call',  label: 'Belafspraak', color: '#5FB0AC' },
  { value: 'email', label: 'E-mail',     color: '#A98AD1' },
  { value: 'note',  label: 'Notitie',    color: '#DDA071' },
]

const DEFAULT_TASK_PRIORITIES = [
  { value: 'low',    label: 'Laag',    color: '#79B58E', is_default: false },
  { value: 'normal', label: 'Normaal', color: '#DDA071', is_default: true },
  { value: 'high',   label: 'Hoog',    color: '#D98A8A', is_default: false },
]

// Tolerant truthy check — the backend may send a real bool, 1/0 or "true"/"false".
const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true'

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
// Carries `is_done` (statuses) and `is_default` (priorities) so the flags survive.
function normalize(raw, fallback) {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return raw
    .filter(it => it.active !== false)
    .sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0))
    .map(it => ({
      value: it.value ?? it.key ?? it.id,
      label: it.label ?? it.name ?? it.value ?? it.key,
      color: it.color ?? '#6B7280',
      is_done: truthy(it.is_done),
      is_default: truthy(it.is_default),
    }))
}

const TaskLookupsContext = createContext(null)

export function TaskLookupsProvider({ children }) {
  const [statuses,   setStatuses]   = useState(DEFAULT_TASK_STATUSES)
  const [types,      setTypes]      = useState(DEFAULT_TASK_TYPES)
  const [priorities, setPriorities] = useState(DEFAULT_TASK_PRIORITIES)
  const [loading,    setLoading]    = useState(true)

  // Fetch each lookup once; a 404/empty keeps the seed fallback so the UI never breaks.
  useEffect(() => {
    if (!COOKIE_AUTH && !localStorage.getItem('auth_token')) { setLoading(false); return }
    const load = (url, fallback, set) =>
      api.get(url).then(r => set(normalize(r.data?.data ?? r.data, fallback))).catch(() => {})
    Promise.allSettled([
      load('/task-statuses',   DEFAULT_TASK_STATUSES,   setStatuses),
      load('/task-types',      DEFAULT_TASK_TYPES,      setTypes),
      load('/task-priorities', DEFAULT_TASK_PRIORITIES, setPriorities),
    ]).finally(() => setLoading(false))
  }, [])

  // value → item helper with a neutral fallback so the UI never crashes.
  const metaIn = (list) => (v) => list.find(i => i.value === v) ?? { value: v, label: v, color: '#9CA3AF', is_done: false }

  // The set of status keys that count as "completed" (for open/overdue/done KPIs).
  const doneStatusValues = statuses.filter(s => s.is_done).map(s => s.value)
  // The default priority key (seeded `is_default`), used to preselect in the modal.
  const defaultPriority = (priorities.find(p => p.is_default) ?? priorities[0])?.value ?? ''

  return (
    <TaskLookupsContext.Provider value={{
      statuses, types, priorities, loading,
      statusMeta:   metaIn(statuses),
      typeMeta:     metaIn(types),
      priorityMeta: metaIn(priorities),
      doneStatusValues, defaultPriority,
    }}>
      {children}
    </TaskLookupsContext.Provider>
  )
}

export function useTaskLookups() {
  const ctx = useContext(TaskLookupsContext)
  if (!ctx) throw new Error('useTaskLookups must be used within a TaskLookupsProvider')
  return ctx
}
