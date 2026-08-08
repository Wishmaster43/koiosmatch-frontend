/**
 * useCustomerLite — minimal customer identity fetch for the second-screen notes
 * popout (F5-uitbreiding, mirrors useCandidateLite). `GET /customers/{id}` is the
 * only single-record endpoint the API exposes today, so this reuses it but
 * deliberately SKIPS the full `mapCustomer` transform (locations/departments/
 * contacts/billing/…) — it only reads the name off the raw response so the
 * popout window's title/header never pays for mapping the whole customer just to
 * show two words. React Query (house standard for server state, §1) gives this
 * cache/dedupe/signal-cancel for free.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface CustomerLite { id: string; name: string; initials: string }

// The subset of the raw customer resource this hook actually reads.
interface RawCustomerLite { id?: string | number; name?: string }

export function useCustomerLite(id: string | undefined) {
  const { data: customer = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    queryKey: ['customers', id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<CustomerLite> => {
      const raw = unwrap<RawCustomerLite>(await api.get(`/customers/${id}`, { signal }))
      const name = raw.name || '?'
      return { id: String(raw.id ?? id), name, initials: initialsOf(name) }
    },
  })
  return { customer, loading, error, reload }
}
