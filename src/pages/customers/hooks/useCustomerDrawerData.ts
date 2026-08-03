/**
 * Customer-drawer data hooks — each drawer tab's fetch lives here so the tab
 * components stay presentational (§3: logic in hooks, not in JSX). All are scope
 * fetches via React Query (A-3: cached + dedup + signal-cancel), disabled until their
 * inputs exist, and tolerant of a missing endpoint (empty/null, never a hard error).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap, unwrapList } from '@/lib/api'
// MATCHES-TAB-1: reuse the matches PAGE's own mapper rather than a third one.
import { mapMatch } from '@/pages/matches/hooks/useMatches'
// SOLLICITATIES-TAB-1: same reuse call as MATCHES-TAB-1 above — the applications
// PAGE's own mapper, not a forked copy (mirrors ScopedMatchesTab's mapMatch reuse).
import { mapApplication } from '@/pages/applications/data/mapApplication'
// SOLLICITATIES-SCOPE-1: the generic scoped fetch (department/location Vacatures
// sub-tab) reused below to resolve a level's OWN vacancy ids for its Sollicitaties
// sub-tab — same hook, same queryKey shape, so the two sub-tabs share one cache entry.
import { useScopedEntityList } from './useScopedEntityList'
import type { RawMatch, MatchRow } from '@/types/match'
import type { ApiApplication, Application } from '@/types/application'
import type { LookupItem } from '@/context/LookupsContext'
import type { Id } from '@/types/common'

export interface CustomerStats { matches_total?: number; active_matches?: number; open_vacancies?: number; fill_rate?: number }

// Customer KPI stats (GET /customers/{id}/stats); null while loading or unavailable.
export function useCustomerStats(id?: Id): CustomerStats | null {
  const { data = null } = useQuery({
    queryKey: ['customers', id, 'stats'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<CustomerStats | null> => {
      const r = await api.get(`/customers/${id}/stats`, { signal })
      return (unwrap(r) ?? null) as CustomerStats | null
    },
  })
  return data
}

export interface VacancyRow { id?: Id; title: string; status: { value?: string; label?: string; color?: string }; applications: number }

// Defensive vacancy row mapper (snake_case-tolerant; status as object or string).
// Keeps the status VALUE (slug) alongside the label/color so callers can filter
// against the tenant lookup's stable value instead of matching on display text.
// SCOPED-LIST-TAB-1: exported so the department/location scoped Vacatures tab
// (ScopedVacanciesTab) reuses this mapper rather than forking a second copy.
export const mapVacancyRow = (v: Record<string, unknown> = {}): VacancyRow => {
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

/**
 * The customer's vacancies (GET /vacancies?customer_id={id}); missing endpoint = empty.
 *
 * This sent `client_id` until 02-08, and the tab showed EVERY vacancy of the bureau. The
 * workaround was honest when it was written — `customer_id` then validated as an array, so a
 * bare uuid 422'd — but `client_id` is not a filter VacancyQuery knows, and an unknown filter
 * is silently ignored rather than rejected. So the 422 stopped and the wrong data started,
 * which is the worse of the two failures: a rejected request is visible, a filter that quietly
 * matches everything is not.
 *
 * VacancyQuery now lists `customer_id` in SCALAR_OR_ARRAY_FILTERS, so the single value works.
 */
export function useCustomerVacancies(customerId?: Id, params?: Record<string, unknown>) {
  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['customers', customerId, 'vacancies', params ?? {}],
    enabled: !!customerId,
    queryFn: async ({ signal }): Promise<VacancyRow[]> =>
      unwrapList<Record<string, unknown>>(await api.get('/vacancies', { params: { customer_id: customerId, ...params }, signal })).rows.map(mapVacancyRow),
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
      return (unwrap(r) ?? null) as PlanningData | null
    },
  })
  return { data, loading }
}

// A customer's match row = the shared MatchRow (mapMatch, matches/hooks/useMatches)
// plus contract_type/contract_status — MatchListResource returns both, but MatchRow
// doesn't carry them (the matches PAGE table has no such columns), so they're read
// straight off the raw row alongside the shared mapper's output rather than forking
// a second mapper for two extra fields.
export interface CustomerMatchRow extends MatchRow {
  contractType: string | null
  contractStatus: string | null
}

// The customer's matches (GET /matches?customer_id={id}), read-only (§3B: the
// Matches tab mirrors the candidate drawer's — a match is opened/edited in its own
// drawer, never here). MatchController validates a plain `customer_id` scalar filter.
export function useCustomerMatches(customerId?: Id) {
  const { data = [], isLoading: loading, isError: error, refetch } = useQuery({
    queryKey: ['customers', customerId, 'matches'],
    enabled: !!customerId,
    queryFn: async ({ signal }): Promise<CustomerMatchRow[]> => {
      const raw = unwrapList<RawMatch>(await api.get('/matches', { params: { customer_id: customerId, per_page: 100 }, signal })).rows
      return raw.map(r => ({
        ...mapMatch(r),
        contractType: (r as RawMatch & { contract_type?: string | null }).contract_type ?? null,
        contractStatus: (r as RawMatch & { contract_status?: string | null }).contract_status ?? null,
      }))
    },
  })
  // Point 1: a "+ Match" create refetches this list (mirrors useCustomerOpportunities'
  // own reload: refetch) instead of leaving the just-created match invisible until a
  // full drawer reopen.
  return { rows: data, loading, error, reload: refetch }
}

// The customer's applications (Sollicitaties sub-tab, GET /applications?customer_id[]=
// {id}) — ApplicationQuery validates `customer_id` as an ARRAY of uuids (measured in
// ApplicationQuery.php:82-83), unlike the scoped vacancy/match filters' bare uuid above,
// so it is array-wrapped here (mirrors useCustomerOpportunities's own array form).
// `funnelTypes` comes from the caller's useLookups() (global LookupsContext, already
// mounted app-wide) so this hook needs no lookup fetch of its own. `enabled` is only
// ever `!!customerId` — laziness (no request before the sub-tab opens) comes from the
// caller not mounting the component that calls this hook until then.
export function useCustomerApplications(customerId?: Id, funnelTypes: LookupItem[] = []) {
  const { data = [], isLoading: loading, isError: error } = useQuery({
    queryKey: ['customers', customerId, 'applications'],
    enabled: !!customerId,
    queryFn: async ({ signal }): Promise<Application[]> =>
      unwrapList<ApiApplication>(await api.get('/applications', { params: { customer_id: [customerId], per_page: 100 }, signal }))
        .rows.map(a => mapApplication(a, funnelTypes)),
  })
  return { rows: data, loading, error }
}

/**
 * SOLLICITATIES-SCOPE-1 — the location/department drill-down's OWN Sollicitaties
 * sub-tab (Danny asked three times at customer level, then again for location and
 * department). ApplicationQuery has no direct customer_location_id/customer_
 * department_id ARRAY filter — the single-value LOC-DEPT-TAB-1 filter
 * (ApplicationQuery.php:88-89/148-157) narrows through the vacancy relation via a
 * whereHas, one id at a time, not a set this hook could reuse for a whole level. So
 * the honest path is a two-step chain: (1) useScopedVacancyIds resolves this
 * level's OWN vacancy ids through the SAME scoped query the Vacatures sub-tab
 * already uses; (2) this hook filters applications by those ids via `vacancy_id[]`
 * (ApplicationQuery.php:33/76-77 — an ARRAY filter, unlike the location/department
 * scalar one). A future direct array filter on /applications would collapse this
 * to one request; until then this stays the honest chain, never a client-side
 * narrowing of a wider unscoped fetch.
 *
 * GUARD (measured in ApplicationQuery.php:162): Laravel's `Request::filled()`
 * treats an empty array as blank, so the `whereIn` is only applied when
 * `vacancy_id` is non-empty — an EMPTY `vacancy_id[]` would silently return every
 * application, unfiltered. `enabled` below refuses to fire for a zero-vacancy
 * scope rather than trust the backend to reject it.
 */
export function useApplicationsByVacancyIds(vacancyIds: Id[], funnelTypes: LookupItem[] = []) {
  const { data = [], isLoading: loading, isError: error } = useQuery({
    queryKey: ['applications', 'by-vacancy-ids', vacancyIds],
    enabled: vacancyIds.length > 0,
    queryFn: async ({ signal }): Promise<Application[]> =>
      unwrapList<ApiApplication>(await api.get('/applications', { params: { vacancy_id: vacancyIds, per_page: 100 }, signal }))
        .rows.map(a => mapApplication(a, funnelTypes)),
  })
  return { rows: data, loading, error }
}

/**
 * Step 1 of the chain above — this level's OWN vacancy ids, resolved through the
 * EXACT same scoped query ScopedVacanciesTab uses (identical queryKey/endpoint/
 * paramName via useScopedEntityList + the shared mapVacancyRow), so if the
 * Vacatures sub-tab was already opened in this drawer session, react-query
 * answers straight from cache instead of firing a second request. `id` is only
 * ever a real value once the CALLER's own Sollicitaties sub-tab is active — an
 * undefined id disables the underlying query, which is where the laziness lives
 * (this hook has no "active tab" concept of its own).
 */
export function useScopedVacancyIds(scope: 'department' | 'location', id: Id | undefined) {
  const paramName = scope === 'department' ? 'customer_department_id' : 'customer_location_id'
  const { rows, loading, error } = useScopedEntityList<VacancyRow>(`${scope}-vacancies`, '/vacancies', paramName, id, mapVacancyRow)
  const vacancyIds = rows.map(v => v.id).filter((v): v is Id => v != null)
  return { vacancyIds, loading, error }
}
