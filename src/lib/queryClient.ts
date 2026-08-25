/**
 * Shared React Query client.
 *
 * Gives the app request de-duplication, caching and transient-error retry for
 * GET data — replacing scattered useEffect + useState fetches. 401/429 are still
 * handled centrally in lib/api.js (session expiry + rate-limit backoff), so here
 * we only retry genuinely transient (5xx/network) failures and never 4xx.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // treat data as fresh for 30s (cuts refetch storms)
      gcTime: 5 * 60_000,
      // REFRESH-FIX-2 (manager advice 23-08, after Danny's "kan je alles nakijken" —
      // "can you check everything over"): ON, not off — a query only actually
      // refetches on focus once it is stale (staleTime above still guards that),
      // so this only closes the "edited elsewhere, still shows old here" class
      // app-wide (e.g. tab-switch back to
      // a drawer after editing the same record in another tab). One-line revert
      // to `false` if this ever proves too chatty in practice.
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // axios errors carry the HTTP status under response.status (not on Error).
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500) return false // auth/perm/validation
        return failureCount < 2
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
  },
})
