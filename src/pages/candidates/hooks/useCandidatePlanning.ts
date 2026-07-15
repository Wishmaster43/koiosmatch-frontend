/**
 * Candidate planning-preferences data layer (§3: logic in hooks; §10: tolerant API).
 *
 * Wires the "Voorkeur & blacklist" sub-tab to the backend contract:
 *   GET    /candidates/{id}/planning-preferences            → all rows
 *   POST   /candidates/{id}/planning-preferences            { kind, linkable_type, linkable_id, reason }
 *   DELETE /candidates/{id}/planning-preferences/{prefId}
 * A preference points (polymorphically) at a customer / location / department; the
 * backend resolves + returns `linkable_name`, 409s a duplicate and 422s an unknown
 * target. Mutations are optimistic and roll back + toast on failure (mirrors
 * useCandidateBranches; ERR-1 — never fail silently, AVG — never lose data).
 *
 * ASSUMPTIONS (confirm with backend, isolated here so a mismatch degrades softly):
 *   - `linkable_type` is the short alias customer|location|department; normType()
 *     also accepts a FQCN morph type ("App\\Models\\Customer").
 *   - GET without `?kind=` returns both kinds; POST echoes back the created row.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { notifyError } from '@/lib/notify'
import type { Id } from '@/types/common'
import type { FavLists } from '../drawer/planningTypes'

export type PrefKind = 'favorite' | 'blacklist'
export type LinkableType = 'customer' | 'location' | 'department'

// One planning preference (favourite or blacklist) for a candidate.
export interface Preference {
  id: Id
  kind: PrefKind
  linkable_type: LinkableType
  linkable_id: Id
  linkable_name: string
  reason?: string
}

// A selectable target in the add-typeahead, grouped per linkable type.
export interface PrefTarget { id: Id; name: string }
export interface PrefTargetGroup { linkable_type: LinkableType; items: PrefTarget[] }

// Loose shape of an API row before normalisation (tolerant of a nested `linkable`).
interface RawPreference {
  id?: Id; kind?: string; linkable_type?: string; linkable_id?: Id
  linkable_name?: string; reason?: string
  linkable?: { id?: Id; type?: string; name?: string; company_name?: string }
}

// The three preference target kinds ↔ their native list endpoints (§10).
const TARGET_ENDPOINTS: Record<LinkableType, string> = {
  customer:   '/customers',
  location:   '/locations',
  department: '/departments',
}

// Tolerant morph-type → short alias (accepts 'customer' or 'App\\Models\\Customer').
function normType(raw: unknown): LinkableType {
  const s = String(raw ?? '').toLowerCase()
  if (s.includes('location'))   return 'location'
  if (s.includes('department')) return 'department'
  return 'customer'
}

// Normalise one API row to our Preference shape (falls back to a nested `linkable`).
function toPreference(row: RawPreference): Preference {
  const l = row.linkable ?? {}
  return {
    id: row.id as Id,
    kind: row.kind === 'blacklist' ? 'blacklist' : 'favorite',
    linkable_type: normType(row.linkable_type ?? l.type),
    linkable_id: (row.linkable_id ?? l.id) as Id,
    linkable_name: String(row.linkable_name ?? l.name ?? l.company_name ?? '—'),
    reason: row.reason ?? '',
  }
}

// Preference names grouped for the open-shifts dimming (FavLists = name arrays).
export function namesByType(prefs: Preference[]): FavLists {
  const out: FavLists = { clients: [], locations: [], departments: [] }
  for (const p of prefs) {
    if (p.linkable_type === 'location') out.locations.push(p.linkable_name)
    else if (p.linkable_type === 'department') out.departments.push(p.linkable_name)
    else out.clients.push(p.linkable_name)
  }
  return out
}

// Load + mutate a candidate's planning preferences (favourite + blacklist).
export function useCandidatePlanningPreferences(candidateId?: Id) {
  const { t } = useTranslation('candidates')
  const [prefs,   setPrefs]   = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // Load all preferences once per candidate; 404 = endpoint not built → empty (calm).
  useEffect(() => {
    if (!candidateId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidateId}/planning-preferences`, { signal: ctrl.signal })
      .then(res => {
        const rows = (unwrapList(res).rows) as RawPreference[]
        setPrefs((Array.isArray(rows) ? rows : []).map(toPreference))
      })
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setPrefs([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [candidateId])

  // Optimistically add a preference; reconcile with the server row, roll back + toast on failure.
  const add = async (kind: PrefKind, target: { linkable_type: LinkableType; linkable_id: Id; linkable_name: string; reason?: string }) => {
    // Client-side duplicate guard (the backend also 409s).
    if (prefs.some(p => p.kind === kind && p.linkable_type === target.linkable_type && String(p.linkable_id) === String(target.linkable_id))) return
    const tempId = `tmp-${Date.now()}`
    const optimistic: Preference = { id: tempId, kind, ...target, reason: target.reason ?? '' }
    setPrefs(prev => [...prev, optimistic])
    try {
      const res = await api.post(`/candidates/${candidateId}/planning-preferences`, {
        kind, linkable_type: target.linkable_type, linkable_id: target.linkable_id, reason: target.reason || undefined,
      })
      const saved = (unwrap(res)) as RawPreference | undefined
      const savedPref = saved && saved.id != null ? toPreference(saved) : optimistic
      setPrefs(prev => prev.map(p => (p.id === tempId ? savedPref : p)))
    } catch (err) {
      setPrefs(prev => prev.filter(p => p.id !== tempId))
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 409 ? t('planning.prefDuplicate') : t('common:actionFailed'))
    }
  }

  // Optimistically remove a preference; restore + toast on failure.
  const remove = async (prefId: Id) => {
    const snapshot = prefs
    setPrefs(cur => cur.filter(p => p.id !== prefId))
    try {
      await api.delete(`/candidates/${candidateId}/planning-preferences/${prefId}`)
    } catch {
      setPrefs(snapshot)
      notifyError(t('common:actionFailed'))
    }
  }

  return {
    favorites: prefs.filter(p => p.kind === 'favorite'),
    blacklist: prefs.filter(p => p.kind === 'blacklist'),
    loading, error, add, remove,
  }
}

// Load the add-typeahead targets (customers / locations / departments) with ids.
export function usePlanningPreferenceTargets() {
  const [groups,  setGroups]  = useState<PrefTargetGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    const types = Object.keys(TARGET_ENDPOINTS) as LinkableType[]
    // Each list soft-fails to an empty group so one missing endpoint never breaks the tab.
    Promise.all(types.map(type =>
      api.get(TARGET_ENDPOINTS[type], { signal: ctrl.signal })
        .then(r => {
          const rows = unwrapList<{ id?: Id; name?: string; company_name?: string }>(r).rows
          const items: PrefTarget[] = rows
            .map(row => ({ id: row.id as Id, name: String(row.name ?? row.company_name ?? '') }))
            .filter(it => it.id != null && it.name)
          return { linkable_type: type, items }
        })
        .catch(() => ({ linkable_type: type, items: [] as PrefTarget[] })),
    ))
      .then(res => { if (!ctrl.signal.aborted) setGroups(res) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [])

  return { groups, loading }
}

// ── Availability (can/can't work, per date + day-part; default = available) ──────

export type DayPart = 'day' | 'morning' | 'afternoon' | 'evening'
export type AvailStatus = 'available' | 'unavailable'

// One availability exception; the absence of an entry means "available".
export interface Availability {
  id: Id
  date: string          // ISO yyyy-mm-dd
  part: DayPart
  status: AvailStatus
  reason?: string
}

// Loose API row (field name for the day-part is confirmed with backend — tolerant here).
interface RawAvailability {
  id?: Id; date?: string; part?: string; day_part?: string; period?: string
  status?: string; reason?: string
}

function toAvailability(row: RawAvailability): Availability {
  const raw = String(row.part ?? row.day_part ?? row.period ?? 'day').toLowerCase()
  const part: DayPart = raw === 'morning' || raw === 'afternoon' || raw === 'evening' ? raw : 'day'
  return {
    id: row.id as Id,
    date: String(row.date ?? ''),
    part,
    status: row.status === 'unavailable' ? 'unavailable' : 'available',
    reason: row.reason ?? '',
  }
}

// Load + mutate a candidate's availability exceptions (holiday/sick/…).
export function useCandidateAvailability(candidateId?: Id) {
  const { t } = useTranslation('candidates')
  const [entries, setEntries] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // Load once per candidate; 404 = endpoint not built → empty (calm).
  useEffect(() => {
    if (!candidateId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidateId}/availability`, { signal: ctrl.signal })
      .then(res => {
        const rows = (unwrapList(res).rows) as RawAvailability[]
        setEntries((Array.isArray(rows) ? rows : []).map(toAvailability))
      })
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setEntries([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [candidateId])

  // Optimistically add an entry; reconcile with the server row, roll back + toast on failure (409 = slot taken).
  const add = async (entry: { date: string; part: DayPart; status: AvailStatus; reason?: string }) => {
    if (entries.some(e => e.date === entry.date && e.part === entry.part)) return
    const tempId = `tmp-${Date.now()}`
    const optimistic: Availability = { id: tempId, ...entry, reason: entry.reason ?? '' }
    setEntries(prev => [...prev, optimistic])
    try {
      const res = await api.post(`/candidates/${candidateId}/availability`, {
        date: entry.date, part: entry.part, status: entry.status, reason: entry.reason || undefined,
      })
      const saved = (unwrap(res)) as RawAvailability | undefined
      const savedEntry = saved && saved.id != null ? toAvailability(saved) : optimistic
      setEntries(prev => prev.map(e => (e.id === tempId ? savedEntry : e)))
    } catch (err) {
      setEntries(prev => prev.filter(e => e.id !== tempId))
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 409 ? t('planning.availDuplicate') : t('common:actionFailed'))
    }
  }

  // Optimistically remove an entry; restore + toast on failure.
  const remove = async (id: Id) => {
    const snapshot = entries
    setEntries(cur => cur.filter(e => e.id !== id))
    try {
      await api.delete(`/candidates/${candidateId}/availability/${id}`)
    } catch {
      setEntries(snapshot)
      notifyError(t('common:actionFailed'))
    }
  }

  return { entries, loading, error, add, remove }
}
