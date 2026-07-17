/**
 * useCustomerCascade — the ONE shared implementation of the customer → location →
 * department → contact cascade (GET /customers/{id}), re-fetching whenever the id
 * changes. Promoted from pages/opportunities/hooks (audit R1 item 2: this exact
 * fetch was triplicated across opportunities/candidates(MatchPlacementModal)/
 * vacancies). Exposes the full `detail` payload too — not just locations/contacts —
 * so callers that also need the takeover-default fields (branch, cost_center,
 * billing_email at each level; MatchPlacementModal's cascade proposal) don't need
 * their own fetch; callers that only need locations/contacts (KlantTab,
 * AddOpportunityModal) simply ignore the extra fields. `refetch` lets a caller
 * force a re-fetch of the SAME customer id (e.g. after inline-creating a contact).
 * The vacancies feature still keeps its own copy (pages/vacancies/hooks/
 * useCustomerCascade.ts) — a separate migration, out of scope here (§2: a feature
 * never reaches into another feature's internals; vacancies is occupied territory).
 */
import { useState, useEffect } from 'react'
import api, { unwrap } from '@/lib/api'
import type { Id } from '@/types/common'

export interface CascadeOption { id?: Id; name?: string }
// Department/location takeover-default fields (cost centre / billing email) —
// optional because most callers' API responses don't carry them yet on
// departments (a known backend gap noted where MatchPlacementModal reads them).
export interface CascadeDepartment extends CascadeOption { cost_center?: string | null; billing_email?: string | null }
export interface CascadeLocation extends CascadeOption {
  departments?: CascadeDepartment[]
  cost_center?: string | null
  billing_email?: string | null
}
export interface CustomerCascadeDetail {
  branch_id?: Id | null
  branch?: { id?: Id; name?: string } | null
  cost_center?: string | null
  billing_email?: string | null
  locations?: CascadeLocation[]
  contacts?: CascadeOption[]
}

export function useCustomerCascade(customerId: string) {
  const [detail, setDetail] = useState<CustomerCascadeDetail | null>(null)

  // Re-fetch the customer detail whenever the picked customer changes; clear it
  // (never stale data from a previous customer) when no customer is picked. The
  // `alive` guard drops a response that resolves after a newer id was picked.
  useEffect(() => {
    if (!customerId) { setDetail(null); return }
    let alive = true
    api.get(`/customers/${customerId}`)
      .then(r => { if (alive) setDetail((unwrap(r)) as CustomerCascadeDetail) })
      .catch(() => { if (alive) setDetail(null) })
    return () => { alive = false }
  }, [customerId])

  // Force a re-fetch of the SAME customer id — e.g. MatchPlacementModal's inline
  // "add contact" needs the fresh contact list before selecting the new one.
  const refetch = () => {
    if (!customerId) return Promise.resolve()
    return api.get(`/customers/${customerId}`)
      .then(r => { setDetail((unwrap(r)) as CustomerCascadeDetail) })
      .catch(() => { setDetail(null) })
  }

  return {
    detail,
    locations: detail?.locations ?? [],
    contacts: detail?.contacts ?? [],
    refetch,
  }
}
