/**
 * useCascadeDefaults — cost-centre and billing-email takeover-default PROPOSALS
 * for the placement form (job 21/22), following the customer→location→department
 * cascade's deepest picked level. Mirrors useRateProposal's "propose but never
 * overwrite a manual edit" pattern: each field freezes the instant the recruiter
 * edits it (the *Dirty flag), so a later customer/location/department pick never
 * clobbers a manual value. Split out of useMatchPlacementForm (audit R1 item 1,
 * MUST-SPLIT) to keep that hook's own single purpose (candidate/relations/
 * contract/financial state + submit) from growing past its size target.
 */
import { useState, useEffect } from 'react'
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import { cascadeValue } from './helpers'

export function useCascadeDefaults({ detail, locationId, departmentId }: {
  detail: CustomerCascadeDetail | null; locationId: string; departmentId: string
}) {
  const [costCenter, setCostCenter] = useState('')
  const [costCenterDirty, setCostCenterDirty] = useState(false)
  const [billingEmails, setBillingEmails] = useState<string[]>([''])
  const [billingDirty, setBillingDirty] = useState(false)

  // Cost-centre PROPOSAL — recomputed live from the deepest picked level that
  // carries a value; frozen the instant the recruiter edits the field by hand.
  useEffect(() => {
    if (costCenterDirty) return
    setCostCenter(cascadeValue(detail, locationId, departmentId, 'cost_center'))
  }, [detail, locationId, departmentId, costCenterDirty])

  // Same proposal pattern for the PRIMARY billing email (slot 0) — extra rows
  // (1+) are the recruiter's own additions and are never touched by the cascade.
  useEffect(() => {
    if (billingDirty) return
    setBillingEmails([cascadeValue(detail, locationId, departmentId, 'billing_email')])
  }, [detail, locationId, departmentId, billingDirty])

  return { costCenter, setCostCenter, setCostCenterDirty, billingEmails, setBillingEmails, setBillingDirty }
}
