/**
 * useSmConnections — the tenant's active ShiftManager planning connections, for the
 * SYNC-1 sync-button picker. Reuses the exact same /planning-connections lookup the
 * workflow sm_* modules already use for their `connection_id` field (Danny 2026-07-14:
 * "zelfde regel als de workflow-modules" — never guess/default a connection). The
 * endpoint returns EVERY active planning connection regardless of external system
 * (value/label only, never credentials — see WorkflowController::planningConnections),
 * so a light label filter keeps non-ShiftManager rows (helloflex/intus/sdb) out of this
 * picker; otherwise the backend would 422 on a mismatched connection_id anyway.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface SmConnectionOption { value: string; label: string }

export function useSmConnections() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['planning-connections'],
    queryFn: async ({ signal }) => {
      const rows = (await api.get('/planning-connections', { signal })).data?.data ?? []
      return (Array.isArray(rows) ? rows : []) as SmConnectionOption[]
    },
    staleTime: 5 * 60_000,
  })
  // The label always embeds the connection's system slug (tenant — system (host)) —
  // match on it so a non-ShiftManager connection never reaches this picker. The
  // endpoint has no ?system= filter yet (BE gap — see the SYNC-1 report).
  const connections = (data ?? []).filter((c) => /\bshiftmanager\b/i.test(c.label))
  return { connections, loading: isLoading, error: isError }
}
