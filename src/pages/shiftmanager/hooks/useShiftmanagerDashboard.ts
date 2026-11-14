/**
 * useShiftmanagerDashboard — data layer for the Shiftmanager dashboard (§3): the SM
 * candidate rows (drill-down lists and row-derived fallbacks), the candidate stats
 * COUNTS, and — only for AI/Workflow
 * packages — recent workflow runs + WhatsApp conversations. Via React Query: each
 * request dedups + caches + auto-cancels; the AI-only calls stay disabled until the
 * package is present (A-3 — replaces four raw useEffect fetches).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { normalizeSmCandidate } from '@/components/reports/useReportCandidates'
import { useSmCandidateStats } from '@/components/reports/useSmCandidateStats'
// House numeric shape (DATUM-1): digits only, so no locale is needed here.
import { hhmm as houseHhmm } from '@/lib/localDate'
// K-3: /workflow-runs is a workflow-EXECUTION endpoint — route it through the
// configurable engine base URL, same as every other run/cancel/logs call.
import { resolveWorkflowBaseURL } from '@/lib/workflowApi'

// ok: true = completed successfully, false = failed/cancelled, null = still in
// flight (running/waiting) — a tri-state so an in-flight run can paint neutral
// instead of borrowing the "completed" success colour (SCHERMWAARHEID-1).
export interface RunItem { name?: string; ok: boolean | null; n?: number; err?: string; time: string }
export interface ConvItem { name: string; msg: string; time: string }

// House HH:mm numeric shape (DATUM-1) from an ISO timestamp — digits only,
// identical in every app language, so no locale parameter is needed here.
const hhmm = (iso?: string) => iso ? houseHhmm(new Date(iso)) : ''

// PERF-1/SM-STATS-3: the row fetch honours the tenant's `candidates_per_page` cap
// (server hard cap 500) and feeds ONLY the drill-down lists plus the row-derived
// fallbacks while stats load or fail. The tile COUNTS (active headcount, activity
// buckets, attention, new this month) read GET /sm_candidates/stats (`activity`,
// `attention`, `registrations_per_month`), so they never undercount past the row
// cap; the activity and attention tiles pass that server count to the drill drawer as `total`.

export function useShiftmanagerDashboard(candidatesPerPage: number, hasAI: boolean) {
  // Candidate rows: the drill-down lists of every tile and the row-derived fallbacks while stats load or fail.
  const candidatesQ = useQuery({
    queryKey: ['sm_candidates', 'dash', candidatesPerPage],
    queryFn: async ({ signal }) => {
      const body = (await api.get('/sm_candidates', { params: { per_page: candidatesPerPage }, signal })).data
      // Normalise first_name/last_name → firstname/lastname (else the drill shows "Onbekend").
      const raw = (Array.isArray(body) ? body : (body?.data ?? [])) as Array<Record<string, unknown>>
      return raw.map(normalizeSmCandidate)
    },
  })

  // Recent workflow runs — only for AI/Workflow packages. Contract: RunPresenter
  // emits workflow_name/candidates_count/error_message/started_at and a terminal
  // status ('success'/'failed'/'cancelled', plus in-flight 'running'/'waiting') —
  // failed/cancelled maps to not-ok, running/waiting maps to the neutral null
  // state (never borrows the completed-success colour), everything else is ok.
  const runsQ = useQuery({
    queryKey: ['workflow-runs', 'dash'],
    enabled: hasAI,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ workflow_name?: string; status?: string; candidates_count?: number; error_message?: string; started_at?: string }>(
        await api.get('/workflow-runs', { params: { per_page: 5 }, signal, baseURL: resolveWorkflowBaseURL() }),
      )
      return rows.map(r => ({
        name: r.workflow_name,
        // F7: a run halted by a connector limit synced nothing — never a green tick.
        ok: (r.status === 'failed' || r.status === 'cancelled' || r.status === 'blocked') ? false
          : (r.status === 'running' || r.status === 'waiting') ? null
          : true,
        n: r.candidates_count,
        err: r.error_message ?? undefined,
        time: hhmm(r.started_at),
      })) as RunItem[]
    },
  })

  // Recent WhatsApp conversations — only for AI/Workflow packages.
  const convQ = useQuery({
    queryKey: ['whatsapp', 'messages', 'dash'],
    enabled: hasAI,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ candidate?: { first_name?: string; last_name?: string }; body?: string; sent_at?: string }>(
        await api.get('/whatsapp/messages', { params: { per_page: 4 }, signal }),
      )
      return rows.map(m => ({
        name: `${m.candidate?.first_name ?? ''} ${m.candidate?.last_name ?? ''}`.trim() || '—',
        msg:  m.body ?? '', time: hhmm(m.sent_at),
      })) as ConvItem[]
    },
  })

  // Server-computed candidate COUNTS (unfiltered, this calendar year) for the activity
  // and attention tiles and the "new this month" pair (see the module doc above).
  const candidateStatsQ = useSmCandidateStats({ year: new Date().getFullYear() })

  return {
    candidates:    candidatesQ.data ?? [],
    loading:       candidatesQ.isLoading,
    error:         candidatesQ.isError,
    refetch:       candidatesQ.refetch,
    runs:          runsQ.data ?? [],
    conversations: convQ.data ?? [],
    candidateStats:        candidateStatsQ.stats,
    candidateStatsLoading: candidateStatsQ.loading,
    candidateStatsError:   candidateStatsQ.error,
  }
}
