/**
 * useCandidateSchedule — the candidate's REAL planning data (G-7, un-mocks the tab):
 *   GET /candidates/{id}/agenda      → scheduled shifts (roster)
 *   GET /candidates/{id}/open-shifts → open shifts the candidate could still be scheduled for
 * The backend rows are sparse (ISO times + customer/function/location/status); this maps them
 * to the RosterShift/OpenShift shapes the panels render — formatting the times and defaulting
 * the fields the backend doesn't provide yet (distance/level/pool → 0/''). Read-only.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { Id } from '@/types/common'
import type { OpenShift, RosterShift } from '../drawer/planningTypes'

interface RawAgenda { id?: Id; status?: string; start_time?: string; end_time?: string; function?: string; customer?: string; location?: string }
interface RawOpen { id?: Id; status?: string; shift_type?: string; start_time?: string; end_time?: string; number_persons?: number; function?: string; customer?: string; location?: string }

// Stable colour from a string so the same client keeps the same bar colour.
// Categorical DATA palette (distinct hues for arbitrary client identity, not semantic
// meaning) — deliberately raw hex, same exemption class as AVATAR_COLORS (§4).
// eslint-disable-next-line no-restricted-syntax
const PALETTE = ['#1B60A9', '#8B5CF6', '#16A34A', '#F59E0B', '#0EA5E9', '#DB2777']
const colorFor = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]

// ISO → "ma 16 jun" (locale-aware short weekday + day + month).
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) : '')
// ISO start + end → "07:00–15:00".
const fmtTime = (a?: string, b?: string) => {
  const t = (x?: string) => (x ? new Date(x).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '')
  return [t(a), t(b)].filter(Boolean).join('–')
}

const unwrapRows = (r: { data?: unknown }): unknown[] => {
  const body = (r?.data as { data?: unknown }) ?? {}
  return (Array.isArray(body.data) ? body.data : Array.isArray(r?.data) ? (r.data as unknown[]) : []) as unknown[]
}

export function useCandidateSchedule(candidateId?: Id) {
  const [roster,     setRoster]     = useState<RosterShift[]>([])
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([])
  const [loading,    setLoading]    = useState(true)

  // Load the real agenda + open shifts once per candidate; each soft-fails to empty.
  useEffect(() => {
    if (!candidateId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    Promise.all([
      api.get(`/candidates/${candidateId}/agenda`, { signal: ctrl.signal })
        .then(r => (unwrapRows(r) as RawAgenda[]).map<RosterShift>(s => ({
          date: fmtDate(s.start_time), time: fmtTime(s.start_time, s.end_time),
          client: s.customer ?? '—', function: s.function, location: s.location ?? '',
          color: colorFor(s.customer ?? ''), workedBefore: 0, favorite: false,
        }))).catch(() => [] as RosterShift[]),
      api.get(`/candidates/${candidateId}/open-shifts`, { signal: ctrl.signal })
        .then(r => (unwrapRows(r) as RawOpen[]).map<OpenShift>(s => ({
          id: s.id as Id, date: fmtDate(s.start_time), time: fmtTime(s.start_time, s.end_time),
          client: s.customer ?? '—', function: s.function ?? '', location: s.location ?? '',
          color: colorFor(s.customer ?? ''), distance: 0, level: 0,
          shiftType: s.shift_type ?? '', openSpots: s.number_persons ?? 1, pool: '',
        }))).catch(() => [] as OpenShift[]),
    ])
      .then(([r, o]) => { if (!ctrl.signal.aborted) { setRoster(r); setOpenShifts(o) } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [candidateId])

  return { roster, openShifts, loading }
}
