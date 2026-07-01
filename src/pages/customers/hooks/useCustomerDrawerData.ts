/**
 * Customer-drawer data hooks — each drawer tab's fetch lives here so the tab
 * components stay presentational (§3: logic in hooks, not in JSX). All are
 * mount/scope fetches with an AbortController and are tolerant of a missing
 * endpoint (treated as empty/null, never a hard error).
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import type { Id } from '@/types/common'

export interface CustomerStats { matches_total?: number; active_matches?: number; open_vacancies?: number; fill_rate?: number }

// Customer KPI stats (GET /customers/{id}/stats); null while loading or unavailable.
export function useCustomerStats(id?: Id): CustomerStats | null {
  const [stats, setStats] = useState<CustomerStats | null>(null)
  useEffect(() => {
    if (!id) return
    const ctrl = new AbortController()
    api.get(`/customers/${id}/stats`, { signal: ctrl.signal })
      .then(r => setStats(r.data?.data ?? r.data ?? null))
      .catch(e => { if (!isAbortError(e)) setStats(null) })
    return () => ctrl.abort()
  }, [id])
  return stats
}

export interface VacancyRow { id?: Id; title: string; status: { label?: string; color?: string }; applications: number }

// Defensive vacancy row mapper (snake_case-tolerant; status as object or string).
const mapVacancyRow = (v: Record<string, unknown> = {}): VacancyRow => {
  const status = v.status
  return {
    id: v.id as Id | undefined,
    title: (v.title as string) ?? '—',
    status: (status && typeof status === 'object')
      ? (status as { label?: string; color?: string })
      : { label: String(v.status_label ?? v.status ?? '—'), color: v.status_color as string | undefined },
    applications: (v.applications_count ?? v.applicationsCount ?? 0) as number,
  }
}

// The customer's vacancies (GET /vacancies?customer_id={id}); missing endpoint = empty.
export function useCustomerVacancies(customerId?: Id, params?: Record<string, unknown>) {
  const [rows, setRows]       = useState<VacancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const paramsKey = JSON.stringify(params ?? {})
  useEffect(() => {
    if (!customerId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    api.get('/vacancies', { params: { customer_id: customerId, ...params }, signal: ctrl.signal })
      .then(res => setRows(unwrapList<Record<string, unknown>>(res).rows.map(mapVacancyRow)))
      .catch(e => { if (!isAbortError(e)) setRows([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [customerId, paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return { rows, loading }
}

export interface ShiftRow { id?: Id; date?: string; shift?: string; department?: string }

// Open flex shifts for a customer (GET /customers/{id}/open-shifts); planning-gated by `enabled`.
export function useCustomerOpenShifts(customerId: Id | undefined, enabled: boolean) {
  const [rows, setRows]       = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!enabled || !customerId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    api.get(`/customers/${customerId}/open-shifts`, { signal: ctrl.signal })
      .then(res => setRows(unwrapList<ShiftRow>(res).rows))
      .catch(e => { if (!isAbortError(e)) setRows([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [enabled, customerId])
  return { rows, loading }
}

export interface UpcomingShift { id?: Id; date?: string; shift?: string; department?: string; candidate?: { name?: string } | string | null }
export interface PlanningData { active_now?: number; upcoming?: UpcomingShift[] }

// Planning summary for a customer scope (GET /customers/{id}/planning-summary); planning-gated.
export function useCustomerPlanning(customerId: Id | undefined, enabled: boolean, params?: Record<string, unknown>) {
  const [data,    setData]    = useState<PlanningData | null>(null)
  const [loading, setLoading] = useState(true)
  const paramsKey = JSON.stringify(params ?? {})
  useEffect(() => {
    if (!enabled || !customerId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    api.get(`/customers/${customerId}/planning-summary`, { params, signal: ctrl.signal })
      .then(r => setData(r.data?.data ?? r.data ?? null))
      .catch(e => { if (!isAbortError(e)) setData(null) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [enabled, customerId, paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading }
}
