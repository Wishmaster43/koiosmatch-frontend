/**
 * useReportsHub — data layer for the #reports hub's attention section: loads
 * GET /reports (App\Http\Controllers\ReportsHubController → ReportsHubService),
 * the nine cross-domain signal cards. Mirrors useCandidatesReport.ts's shape
 * exactly: one cached, cancellable React Query call, four states normalised
 * to { data, loading, error, refetch }. Tenant-wide, no period/filters — this
 * is a landing overview, not a sliced report (see the backend service's own
 * doc comment).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ReportsHubData } from '@/types/analytics'

// Cached, cancellable /reports fetch — the nine attention-section signal cards.
export function useReportsHub() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', 'hub'],
    queryFn: async ({ signal }) => ((await api.get('/reports', { signal })).data ?? null) as ReportsHubData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, errorObject: error, refetch }
}

// True for an axios 403 — the tenant/user lacks reports.view; the section then
// renders nothing rather than an error banner (the KPI band above stays).
export function isReportsHubForbidden(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 403
}
