/**
 * useCandidateSchedule — the candidate's REAL planning data (G-7, un-mocks the tab):
 *   GET /candidates/{id}/agenda      → scheduled shifts (roster)
 *   GET /candidates/{id}/open-shifts → open shifts the candidate could still be scheduled for
 * The backend rows are sparse (ISO times + customer/function/location/status); this maps them
 * to the RosterShift/OpenShift shapes the panels render — formatting the times and defaulting
 * the fields the backend doesn't provide yet (distance/level/pool → 0/''). Read-only.
 *
 * HONEST-PLANNING-1: neither route carries a planning_configured split yet (unlike the
 * customer side, which now answers 200/meta.planning_configured:false for "no coupling").
 * So a candidate here cannot yet distinguish "not configured" from "actually broken" — the
 * only distinction available today is success vs. request failure, and this hook makes THAT
 * one honest: a failed request sets its own `error`, a genuinely empty 200 sets an empty
 * array. The two sources are loaded independently (own AbortController, own error, own
 * reload) so one endpoint failing never blanks the other's data.
 * BACKEND ASK: give `/candidates/{id}/agenda` and `/candidates/{id}/open-shifts` the same
 * meta.planning_configured / reason split CustomerPlanningController got (PLANNING-CONFIG-1),
 * so an unconfigured agency renders its own calm "not configured" copy instead of reusing
 * the empty-state text a genuinely empty roster would show.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { useLocale } from '@/lib/datetime'
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

// ISO → "ma 16 jun" (locale-aware short weekday + day + month) — locale is passed
// in by the hook below (useLocale()), never hardcoded.
const fmtDate = (iso: string | undefined, locale: string) =>
  (iso ? new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) : '')
// ISO start + end → "07:00–15:00".
const fmtTime = (a: string | undefined, b: string | undefined, locale: string) => {
  const t = (x?: string) => (x ? new Date(x).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '')
  return [t(a), t(b)].filter(Boolean).join('–')
}

const unwrapRows = (r: { data?: unknown }): unknown[] => {
  const body = (r?.data as { data?: unknown }) ?? {}
  return (Array.isArray(body.data) ? body.data : Array.isArray(r?.data) ? (r.data as unknown[]) : []) as unknown[]
}

// The candidate's scheduled shifts (agenda) — its own load/error/reload, independent
// of the open-shifts source below.
function useCandidateAgenda(candidateId: Id | undefined, locale: string) {
  const [roster,  setRoster]  = useState<RosterShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Fetches and maps the candidate's roster; retriable via attempt, and aborted on unmount/id change so a stale response never lands.
  useEffect(() => {
    if (!candidateId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidateId}/agenda`, { signal: ctrl.signal })
      .then(r => setRoster((unwrapRows(r) as RawAgenda[]).map<RosterShift>(s => ({
        date: fmtDate(s.start_time, locale), time: fmtTime(s.start_time, s.end_time, locale),
        client: s.customer ?? '—', function: s.function, location: s.location ?? '',
        color: colorFor(s.customer ?? ''), workedBefore: 0, favorite: false,
      }))))
      .catch(err => {
        if (isAbortError(err)) return
        setError(true)
        setRoster([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [candidateId, locale, attempt])

  return { roster, loading, error, reload: useCallback(() => setAttempt(a => a + 1), []) }
}

// The open shifts this candidate could still be scheduled for — its own load/error/reload.
function useCandidateOpenShifts(candidateId: Id | undefined, locale: string) {
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)
  const [attempt,    setAttempt]    = useState(0)

  // Fetches and maps the open shifts this candidate could still take; retriable via attempt, and aborted on unmount/id change so a stale response never lands.
  useEffect(() => {
    if (!candidateId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidateId}/open-shifts`, { signal: ctrl.signal })
      .then(r => setOpenShifts((unwrapRows(r) as RawOpen[]).map<OpenShift>(s => ({
        id: s.id as Id, date: fmtDate(s.start_time, locale), time: fmtTime(s.start_time, s.end_time, locale),
        client: s.customer ?? '—', function: s.function ?? '', location: s.location ?? '',
        color: colorFor(s.customer ?? ''), distance: 0, level: 0,
        shiftType: s.shift_type ?? '', openSpots: s.number_persons ?? 1, pool: '',
      }))))
      .catch(err => {
        if (isAbortError(err)) return
        setError(true)
        setOpenShifts([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [candidateId, locale, attempt])

  return { openShifts, loading, error, reload: useCallback(() => setAttempt(a => a + 1), []) }
}

export function useCandidateSchedule(candidateId?: Id) {
  // App-wide active locale (§5) — fed into the date/time formatters below instead
  // of a hardcoded 'nl-NL'.
  const locale = useLocale()
  // Two independent sources — a failure on one must never blank the other (§9).
  const agenda = useCandidateAgenda(candidateId, locale)
  const open   = useCandidateOpenShifts(candidateId, locale)

  return {
    roster: agenda.roster, rosterLoading: agenda.loading, rosterError: agenda.error, reloadRoster: agenda.reload,
    openShifts: open.openShifts, openShiftsLoading: open.loading, openShiftsError: open.error, reloadOpenShifts: open.reload,
    // Combined convenience flag for callers that only need one "still loading" signal.
    loading: agenda.loading || open.loading,
  }
}
