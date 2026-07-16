/**
 * useDashboardData — the dashboard's server state in one hook (audit item 21):
 * the two stats aggregates, the main /dashboard summary + /dashboard/charts
 * (refetched when the topbar filters change), and the two light meta.total
 * counts. Extracted from Dashboard.tsx so the component stays declarative (§3);
 * behaviour is identical — heavyGet dedup/cooldown (PERF-DASH-1), fail-soft
 * catches, and abort on tenant/filter change all preserved verbatim.
 */
import { useEffect, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { heavyGet } from '@/lib/heavyGet'
import type { Id } from '@/types/common'

// Loose server shapes — the dashboard reads defensively (mirrors the old inline types).
export interface DashboardServerState<Stats, Opp, Dash, Charts> {
  stats: Stats | null
  opp: Opp | null
  dash: Dash | null
  dashCharts: Charts | null
  matchesTotal: number | null
  vacanciesTotal: number | null
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

  // Distributions: /candidates/stats is live; /opportunities/stats best-effort.
  useEffect(() => {
    const ctrl = new AbortController()
    heavyGet('/candidates/stats', { signal: ctrl.signal })
      .then(r => setStats((unwrap<Stats>(r)) ?? null)).catch(() => {})
    heavyGet('/opportunities/stats', { signal: ctrl.signal })
      .then(r => setOpp((unwrap<Opp>(r)) ?? null)).catch(() => setOpp(null))
    return () => ctrl.abort()
  }, [tenantId])

  // Summary + charts — refetched whenever a topbar filter changes (serialised key).
  const filterKey = JSON.stringify(filterParams)
  useEffect(() => {
    const ctrl = new AbortController()
    const params = JSON.parse(filterKey) as Record<string, unknown>
    heavyGet('/dashboard', { params, signal: ctrl.signal })
      .then(r => setDash((r.data as Dash) ?? null)).catch(() => {})
    // Dedicated charts endpoint (out-timeseries + net); fail-soft when absent.
    heavyGet('/dashboard/charts', { params, signal: ctrl.signal })
      .then(r => setDashCharts((unwrap<Charts>(r)) ?? null)).catch(() => setDashCharts(null))
    return () => ctrl.abort()
  }, [tenantId, filterKey])

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
  }, [tenantId])

  return { stats, opp, dash, dashCharts, matchesTotal, vacanciesTotal }
}
