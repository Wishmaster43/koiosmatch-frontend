/**
 * useCustomerCascade — loads one customer's locations (with nested departments)
 * and contacts via GET /customers/{id}, re-fetching whenever the id changes.
 * Own copy for the vacancies feature (VACATURES-100 V3-V6): a feature never
 * imports another feature's internals (§2), so this mirrors
 * pages/opportunities/hooks/useCustomerCascade.ts verbatim rather than reaching
 * across features — same cascade behaviour as KlantTab/MatchPlacementModal.
 */
import { useState, useEffect } from 'react'
import api, { unwrap } from '@/lib/api'
import type { Id } from '@/types/common'

interface CascadeOption { id?: Id; name?: string }
interface CustomerLocation extends CascadeOption { departments?: CascadeOption[] }
interface CustomerDetail {
  locations?: CustomerLocation[]
  contacts?: CascadeOption[]
}

export function useCustomerCascade(customerId: string) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null)

  // Re-fetch the customer detail whenever the picked customer changes; clear it
  // (never stale data from a previous customer) when no customer is picked.
  useEffect(() => {
    if (!customerId) { setDetail(null); return }
    let alive = true
    api.get(`/customers/${customerId}`)
      .then(r => { if (alive) setDetail((unwrap(r)) as CustomerDetail) })
      .catch(() => { if (alive) setDetail(null) })
    return () => { alive = false }
  }, [customerId])

  return {
    locations: detail?.locations ?? [],
    contacts: detail?.contacts ?? [],
  }
}
