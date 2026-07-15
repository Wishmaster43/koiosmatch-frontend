/**
 * useCustomerCascade — loads one customer's locations (with nested departments)
 * and contacts via GET /customers/{id}, re-fetching whenever the id changes.
 * Shared by AddOpportunityModal (create) and KlantTab (drawer edit) so the
 * customer → location → department → contact cascade behaves identically in
 * both places (mirrors MatchPlacementModal's cascade on the candidate side).
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
