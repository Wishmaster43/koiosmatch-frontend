/**
 * Customer-drawer data hooks — each drawer tab's fetch lives here so the tab
 * components stay presentational (§3: logic in hooks, not in JSX). All are scope
 * fetches via React Query (A-3: cached + dedup + signal-cancel), disabled until their
 * inputs exist, and tolerant of a missing endpoint (empty/null, never a hard error).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface CustomerStats { matches_total?: number; active_matches?: number; open_vacancies?: number; fill_rate?: number }

// Customer KPI stats (GET /customers/{id}/stats); null while loading or unavailable.
export function useCustomerStats(id?: Id): CustomerStats | null {
  const { data = null } = useQuery({
    queryKey: ['customers', id, 'stats'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<CustomerStats | null> => {
      const r = await api.get(`/customers/${id}/stats`, { signal })
      return (r.data?.data ?? r.data ?? null) as CustomerStats | null
    },
  })
  return data
}

export interface VacancyRow { id?: Id; title: string; status: { value?: string; label?: string; color?: string }; applications: number }

// Defensive vacancy row mapper (snake_case-tolerant; status as object or string).
// Keeps the status VALUE (slug) alongside the label/color so callers can filter
// against the tenant lookup's stable value instead of matching on display text.
const mapVacancyRow = (v: Record<string, unknown> = {}): VacancyRow => {
  const status = v.status as { value?: string; label?: string; color?: string } | string | undefined
  return {
    id: v.id as Id | undefined,
    title: (v.title as string) ?? '—',
    status: (status && typeof status === 'object')
      ? status
      : { value: v.status_value as string | undefined ?? (typeof status === 'string' ? status : undefined), label: String(v.status_label ?? status ?? '—'), color: v.status_color as string | undefined },
    applications: (v.applications_count ?? v.applicationsCount ?? 0) as number,
  }
}

// The customer's vacancies (GET /vacancies?client_id={id}); missing endpoint = empty.
// NB: the filter param is `client_id` — since the BE refactor `customer_id` validates
// as an ARRAY (bulk vocabulary) so a bare uuid 422s (seam catch 2026-07-04).
export function useCustomerVacancies(customerId?: Id, params?: Record<string, unknown>) {
  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['customers', customerId, 'vacancies', params ?? {}],
    enabled: !!customerId,
    queryFn: async ({ signal }): Promise<VacancyRow[]> =>
      unwrapList<Record<string, unknown>>(await api.get('/vacancies', { params: { client_id: customerId, ...params }, signal })).rows.map(mapVacancyRow),
  })
  return { rows: data, loading }
}

// The customer's opportunities (Kansen), via GET /opportunities?customer_id[]={id}
// (OpportunityQuery accepts customer_id as an array filter). Read-only list; the
// tab's own create/delete actions call the API directly and `reload()` after.
export function useCustomerOpportunities(customerId?: Id) {
  const { data = [], isLoading: loading, isError: error, refetch } = useQuery({
    queryKey: ['customers', customerId, 'opportunities'],
    enabled: !!customerId,
    queryFn: async ({ signal }) =>
      unwrapList<Record<string, unknown>>(await api.get('/opportunities', { params: { customer_id: [customerId] }, signal })).rows,
  })
  return { rows: data, loading, error, reload: refetch }
}

export interface ShiftRow { id?: Id; date?: string; shift?: string; department?: string }

// Open flex shifts for a customer (GET /customers/{id}/open-shifts); planning-gated by `enabled`.
export function useCustomerOpenShifts(customerId: Id | undefined, enabled: boolean) {
  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['customers', customerId, 'open-shifts'],
    enabled: enabled && !!customerId,
    queryFn: async ({ signal }): Promise<ShiftRow[]> => unwrapList<ShiftRow>(await api.get(`/customers/${customerId}/open-shifts`, { signal })).rows,
  })
  return { rows: data, loading }
}

export interface UpcomingShift { id?: Id; date?: string; shift?: string; department?: string; candidate?: { name?: string } | string | null }
export interface PlanningData { active_now?: number; upcoming?: UpcomingShift[] }

// Planning summary for a customer scope (GET /customers/{id}/planning-summary); planning-gated.
export function useCustomerPlanning(customerId: Id | undefined, enabled: boolean, params?: Record<string, unknown>) {
  const { data = null, isLoading: loading } = useQuery({
    queryKey: ['customers', customerId, 'planning-summary', params ?? {}],
    enabled: enabled && !!customerId,
    queryFn: async ({ signal }): Promise<PlanningData | null> => {
      const r = await api.get(`/customers/${customerId}/planning-summary`, { params, signal })
      return (r.data?.data ?? r.data ?? null) as PlanningData | null
    },
  })
  return { data, loading }
}
