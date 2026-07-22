/**
 * useCascadeDefaults — cost-centre and billing-email takeover-default PROPOSALS
 * for the placement form (job 21/22). The two fields follow DIFFERENT rules
 * (Danny 2026-07-22): cost-centre follows the customer→location→department
 * cascade's deepest picked level, while billing email is ALWAYS the customer's
 * own address regardless of the picked location/department ("facturatie blijft
 * het facturatie-adres dat aan de klant gekoppeld zit"). Both still mirror
 * useRateProposal's "propose but never overwrite a manual edit" pattern: each
 * field freezes the instant the recruiter edits it (the *Dirty flag), so a later
 * customer/location/department pick never clobbers a manual value. Split out of
 * useMatchPlacementForm (audit R1 item 1, MUST-SPLIT) to keep that hook's own
 * single purpose (candidate/relations/contract/financial state + submit) from
 * growing past its size target.
 */
import { useState, useEffect } from 'react'
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import { cascadeValue, customerBillingEmail } from './helpers'

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
    setCostCenter(cascadeValue(detail, locationId, departmentId))
  }, [detail, locationId, departmentId, costCenterDirty])

  // Billing-email PROPOSAL (PRIMARY slot 0 only — extra rows are the recruiter's
  // own additions, never touched by the cascade) — always the customer's own
  // billing_email, independent of the picked location/department; still frozen
  // the instant the recruiter edits it by hand.
  useEffect(() => {
    if (billingDirty) return
    setBillingEmails([customerBillingEmail(detail)])
  }, [detail, billingDirty])

  return { costCenter, setCostCenter, setCostCenterDirty, billingEmails, setBillingEmails, setBillingDirty }
}
