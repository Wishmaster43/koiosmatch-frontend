/**
 * useIntegrationHealth: the permanent connection status of one connector, read from
 * GET /integrations (health, health_error, health_error_message, health_checked_at).
 * Polled every 59 minutes (the BE probes hourly); absent fields mean 'unknown'.
 */
import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getIntegrations, type ConnectorId, type IntegrationSummary } from './integrationsApi'

// Poll cadence: just under the BE's hourly probe so a fresh result is never missed for long.
export const HEALTH_REFETCH_MS = 59 * 60_000
const HEALTH_KEY = ['integrations', 'health'] as const

export interface IntegrationHealth {
  state: 'ok' | 'error' | 'unknown'
  errorCode: string | null
  errorMessage: string | null
  checkedAt: string | null
}

// Maps one summary row to the UI shape; a missing row or unknown value is 'unknown'.
export function mapHealth(row: IntegrationSummary | undefined): IntegrationHealth {
  const state = row?.health === 'ok' || row?.health === 'error' ? row.health : 'unknown'
  return {
    state,
    errorCode: row?.health_error ?? null,
    errorMessage: row?.health_error_message ?? null,
    checkedAt: row?.health_checked_at ?? null,
  }
}

// Shared list query plus a per-connector selector and a refresh() for after save and test.
export function useIntegrationHealth(connector: ConnectorId) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: HEALTH_KEY,
    queryFn: getIntegrations,
    refetchInterval: HEALTH_REFETCH_MS,
    refetchOnWindowFocus: true,
  })
  const health = useMemo(() => mapHealth(data?.find((r) => r.connector === connector)), [data, connector])
  // Refetch now: the BE stores the same fields on a settings save and on a manual test.
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: HEALTH_KEY })
  }, [queryClient])
  return { health, refresh }
}
