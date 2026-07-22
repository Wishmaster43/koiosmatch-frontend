/**
 * useDashboardData — the dashboard's server state in one hook (audit item 21):
 * the two stats aggregates, the main /dashboard summary + /dashboard/charts
 * (refetched when the topbar filters change), and the two light meta.total
 * counts. Extracted from Dashboard.tsx so the component stays declarative (§3);
 * behaviour is identical — heavyGet dedup/cooldown (PERF-DASH-1), fail-soft
 * catches, and abort on tenant/filter change all preserved verbatim.
 *
 * /candidates/stats and /dashboard are the two CRITICAL feeds the KPI strip and
 * charts render from — a failure there must surface as a real error, not a
 * dashboard full of "—" that reads as genuine zeros (audit finding). Their own
 * loading/error is tracked and combined into the returned `loading`/`error`.
 * /opportunities/stats, /dashboard/charts and the matches/vacancies totals stay
 * best-effort/fail-soft, unchanged — they are optional enrichments, not the
 * page's core data.
 */
import { useEffect, useState, useCallback } from 'react'
import api, { unwrap } from '@/lib/api'
import { heavyGet } from '@/lib/heavyGet'
import { isAbortError } from '@/lib/mocks'
import type { Id } from '@/types/common'

// Loose server shapes — the dashboard reads defensively (mirrors the old inline types).
export interface DashboardServerState<Stats, Opp, Dash, Charts> {
  stats: Stats | null
  opp: Opp | null
  dash: Dash | null
  dashCharts: Charts | null
  matchesTotal: number | null
  vacanciesTotal: number | null
  loading: boolean
  error: boolean
  retry: () => void
}

export function useDashboardData<Stats, Opp, Dash, Charts>({ tenantId, filterParams }: {
  tenantId?: Id | null
  // Single-value dashboard filters (period/status/location_id) — a NEW OBJECT per
  // change is fine: the effect keys on its serialised form to avoid loops.
  filterParams: Record<string, unknown>
}): DashboardServerState<Stats, Opp, Dash, Charts> {
  const [stats, setStats] = useState<Stats | null>(null)
  const [opp,   setOpp]   = useState<Opp | null>(null)
  const [dash,  setDash]  = useState<Dash | null>(null)
  const [dashCharts, setDashCharts] = useState<Charts | null>(null)
  const [matchesTotal,   setMatchesTotal]   = useState<number | null>(null)
  const [vacanciesTotal, setVacanciesTotal] = useState<number | null>(null)
  // Per-feed loading/error for the two critical requests, combined below.
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError,   setStatsError]   = useState(false)
  const [dashLoading,  setDashLoading]  = useState(true)
  const [dashError,    setDashError]    = useState(false)
  // Bumping this re-runs every effect below — the "retry" the error notice offers.
  const [retryKey, setRetryKey] = useState(0)
  const retry = useCallback(() => setRetryKey(k => k + 1), [])

  // Distributions: /candidates/stats is critical (tracked loading/error);
  // /opportunities/stats stays best-effort.
  useEffect(() => {
    const ctrl = new AbortController()
    setStatsLoading(true); setStatsError(false)
    heavyGet('/candidates/stats', { signal: ctrl.signal })
      .then(r => setStats((unwrap<Stats>(r)) ?? null))
      .catch(err => { if (!isAbortError(err)) setStatsError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setStatsLoading(false) })
    heavyGet('/opportunities/stats', { signal: ctrl.signal })
      .then(r => setOpp((unwrap<Opp>(r)) ?? null)).catch(() => setOpp(null))
    return () => ctrl.abort()
  }, [tenantId, retryKey])

  // Summary + charts — refetched whenever a topbar filter changes (serialised key).
  // /dashboard is critical (tracked loading/error); /dashboard/charts (dedicated
  // out-timeseries + net feed) stays fail-soft when absent.
  const filterKey = JSON.stringify(filterParams)
  useEffect(() => {
    const ctrl = new AbortController()
    const params = JSON.parse(filterKey) as Record<string, unknown>
    setDashLoading(true); setDashError(false)
    heavyGet('/dashboard', { params, signal: ctrl.signal })
      .then(r => setDash((r.data as Dash) ?? null))
      .catch(err => { if (!isAbortError(err)) setDashError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setDashLoading(false) })
    heavyGet('/dashboard/charts', { params, signal: ctrl.signal })
      .then(r => setDashCharts((unwrap<Charts>(r)) ?? null)).catch(() => setDashCharts(null))
    return () => ctrl.abort()
  }, [tenantId, filterKey, retryKey])

  // Plaatsingen/vacatures = light meta.total fetches (Danny 2026-07-06) until
  // dedicated backend feeds land.
  useEffect(() => {
    let alive = true
    api.get('/matches', { params: { per_page: 1 }, quiet404: true })
      .then(r => { if (alive) setMatchesTotal(r.data?.meta?.total ?? (Array.isArray(r.data?.data) ? r.data.data.length : null)) })
      .catch(() => {})
    api.get('/vacancies', { params: { per_page: 1 }, quiet404: true })
      .then(r => { if (alive) setVacanciesTotal(r.data?.meta?.total ?? null) })
      .catch(() => {})
    return () => { alive = false }
  }, [tenantId, retryKey])

  return {
    stats, opp, dash, dashCharts, matchesTotal, vacanciesTotal,
    loading: statsLoading || dashLoading, error: statsError || dashError, retry,
  }
}
