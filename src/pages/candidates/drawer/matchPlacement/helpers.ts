/**
 * matchPlacement/helpers — pure functions shared by useMatchPlacementForm and its
 * section components. Split out of MatchPlacementModal.tsx (audit R1 item 1,
 * MUST-SPLIT) so the 422-mapping table and the cascade/date math don't live
 * inside a 500+ line component file.
 */
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'

// 422 field-error keys are snake_case; map them back to this form's field/state names.
export const API_TO_FORM: Record<string, string> = {
  candidate_id: 'pickedCandidateId', customer_id: 'customerId',
  customer_location_id: 'locationId', customer_department_id: 'departmentId', contact_id: 'contactId',
  function_title: 'func', contract_type: 'contractType', start_date: 'startDate', end_date: 'endDate',
  hours_per_week: 'hours', cao: 'cao', scale: 'scale', step: 'step',
  purchase_rate: 'purchase', sell_rate: 'sell', cost_center: 'costCenter', billing_emails: 'billingEmails',
  remarks: 'remarks', vacancy_id: 'vacancyId', owner_id: 'ownerId', branch_id: 'branchId',
}

// Deepest-first takeover-default lookup for one field (afdeling > locatie > klant):
// returns whichever picked level carries a non-empty value, else ''. Department-
// level values are simply undefined until the BE ships the columns, so this
// silently falls through to location/customer — no special-casing needed here.
export function cascadeValue(detail: CustomerCascadeDetail | null, locationId: string, departmentId: string, field: 'cost_center' | 'billing_email'): string {
  const loc = detail?.locations?.find(l => String(l.id) === locationId)
  const dept = loc?.departments?.find(d => String(d.id) === departmentId)
  return dept?.[field] || loc?.[field] || detail?.[field] || ''
}

// Today as an input[type=date] value (YYYY-MM-DD) — the start-date PROPOSAL
// (job 19); the recruiter can still change it, it's just a sensible default.
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Add N days to an input[type=date] value (YYYY-MM-DD) — the end-date PROPOSAL
// (7.1) from the picked contract type's default duration.
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
