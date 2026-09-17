/**
 * useOutreachFleetStats — KPI-RIJ-9-1 (O22, OUTREACH-STATS-1): the fleet-wide,
 * unwindowed outreach KPI strip data, `GET /outreach-campaigns/stats`
 * (outreach.view). Distinct from the per-campaign `useOutreachStats` (GET
 * /outreach-campaigns/{id}/stats, the drawer's Stats tab) — do not confuse the
 * two. Kept as its own small react-query hook (mirrors the customers/
 * vacancies stats pattern) so useOutreachInsights stays a pure, hook-free
 * derivation the existing test suite can render without a QueryClientProvider.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

// CONTRACT-CHANGELOG "KLEIN-BE-1 · OUTREACH-STATS-1" (17-09) — the endpoint has
// no 2xx schema in api-generated.ts yet, so this shape is hand-written from the
// changelog's verbatim example (§10). by_status = fleet-wide TARGET pipeline
// distribution; by_channel = a CAMPAIGN-level count per channel.
export interface OutreachFleetStats {
  by_status?: { todo?: number; contacted?: number; skipped?: number; answered?: number }
  by_channel?: { call?: number; email?: number; whatsapp?: number }
  called_today?: number
  to_call?: number
  reached_pct?: number | null
  overdue?: number
}

// Fleet-wide outreach KPI aggregate — never paginated, no filter params (it IS
// the aggregate, §10) — a missing/blocked endpoint degrades to null, not an error,
// so the page's existing 5 cards keep working while these 4 stay dashed.
export function useOutreachFleetStats() {
  const { data } = useQuery({
    queryKey: ['outreach-campaigns', 'stats'],
    queryFn: async ({ signal }): Promise<OutreachFleetStats | null> => {
      try {
        const res = await api.get('/outreach-campaigns/stats', { signal })
        return (unwrap(res) ?? null) as OutreachFleetStats | null
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) return null
        throw err
      }
    },
  })
  return data ?? null
}
