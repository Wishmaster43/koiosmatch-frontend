/**
 * useShiftmanagerDashboard — data layer for the ShiftManager dashboard (§3): SM
 * candidates (feed the "new this month" KPI), shift KPIs, and — only for AI/Workflow
 * packages — recent workflow runs + WhatsApp conversations. Via React Query: each
 * request dedups + caches + auto-cancels; the AI-only calls stay disabled until the
 * package is present (A-3 — replaces four raw useEffect fetches).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { normalizeSmCandidate } from '@/components/reports/useReportCandidates'

// Shift KPI stats from /sm_reports/dashboard.
export interface SmDashStats {
  open_hours?: number; hours_this_month?: number; occupancy_pct?: number
  messages_sent?: number; response_rate_pct?: number; [k: string]: unknown
}
export interface RunItem { name?: string; ok: boolean; n?: number; err?: string; time: string }
export interface ConvItem { name: string; msg: string; time: string }

// Locale-aware HH:MM from an ISO timestamp.
const hhmm = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''

export function useShiftmanagerDashboard(candidatesPerPage: number, hasAI: boolean) {
  // Candidates feed the (real) "new this month" KPI card.
  const candidatesQ = useQuery({
    queryKey: ['sm_candidates', 'dash', candidatesPerPage],
    queryFn: async ({ signal }) => {
      const body = (await api.get('/sm_candidates', { params: { per_page: candidatesPerPage }, signal })).data
      // Normalise first_name/last_name → firstname/lastname (else the drill shows "Onbekend").
      const raw = (Array.isArray(body) ? body : (body?.data ?? [])) as Array<Record<string, unknown>>
      return raw.map(normalizeSmCandidate)
    },
  })

  // Shift KPIs from the ShiftManager report endpoint.
  const statsQ = useQuery({
    queryKey: ['sm_reports', 'dashboard'],
    queryFn: async ({ signal }) => ((await api.get('/sm_reports/dashboard', { signal })).data ?? null) as SmDashStats | null,
  })

  // Recent workflow runs — only for AI/Workflow packages.
  const runsQ = useQuery({
    queryKey: ['workflow-runs', 'dash'],
    enabled: hasAI,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ name?: string; status?: string; processed_count?: number; error?: string; started_at?: string }>(
        await api.get('/workflow-runs', { params: { per_page: 5 }, signal }),
      )
      return rows.map(r => ({ name: r.name, ok: (r.status ?? 'ok') === 'ok', n: r.processed_count, err: r.error, time: hhmm(r.started_at) })) as RunItem[]
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

  return {
    candidates:    candidatesQ.data ?? [],
    loading:       candidatesQ.isLoading,
    stats:         statsQ.data ?? null,
    runs:          runsQ.data ?? [],
    conversations: convQ.data ?? [],
  }
}
