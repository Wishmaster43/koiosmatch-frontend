/**
 * MergeSubEntityModal — absorb a duplicate LOCATION or DEPARTMENT into a survivor,
 * scope-parameterized (mirrors ScopedSollicitatiesTab's `scope` convention, §11 —
 * one shared component, never two near-identical copies). Thin wrapper around the
 * shared MergeEntityModal (picking UI + survivor flow); this file only owns the
 * scope-specific request shape.
 *
 * Route direction mirrors the contact route exactly: POST …/{DUPLICATE}/merge
 * { target_id: SURVIVOR } — the path id is the loser, the body names the winner
 * (CustomerLocationController::merge / CustomerDepartmentController::merge). The
 * other record is soft-deleted server-side (recoverable via the Gearchiveerd view —
 * LOCATIE-SAMENVOEGEN-1 / AFDELING-SAMENVOEGEN-1 merge into a soft-delete, never a
 * hard delete).
 *
 * No search endpoint, and that is the point (same reasoning as MergeContactModal):
 * the duplicate is chosen from the customer's OWN already-loaded list, filtered in
 * memory — the route is scoped to one customer and resolves both ids through it,
 * so a tenant-wide search would only ever produce cross-customer 422s.
 */
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { LOCATIONS_CHANGED_EVENT } from '../hooks/useCustomerLocations'
import { DEPARTMENTS_CHANGED_EVENT } from '../hooks/useCustomerDepartments'
import type { Id } from '@/types/common'
import MergeEntityModal from './MergeEntityModal'

export type MergeSubEntityScope = 'location' | 'department'

// Only the fields the two picker cards show — never the whole record (§8).
export interface MergeCandidate { id: Id; name: string; code?: string }

// Resolves the scope's i18n branch, route segment and changed-event — the three
// things that actually differ between location and department merges.
export default function MergeSubEntityModal({ scope, customerId, current, others, onClose, onMerged }: {
  scope: MergeSubEntityScope
  /** Scopes the route; both records are resolved through THIS customer server-side. */
  customerId: Id
  current: MergeCandidate
  /** The customer's other locations/departments — the only merge candidates that can exist. */
  others: MergeCandidate[]
  onClose: () => void
  onMerged: (survivorId: Id) => void
}) {
  // One namespace, two key prefixes — `locations.merge.*` / `departments.merge.*`
  // mirror `contacts.merge.*` verbatim (same wording, same structure).
  const ns = scope === 'location' ? 'locations' : 'departments'
  const { t } = useTranslation('customers')

  // The DUPLICATE goes in the path, the SURVIVOR in the body — getting this
  // backwards deletes the record the recruiter chose to keep.
  const mergeRequest = async (duplicateId: Id, survivorId: Id) => {
    await api.post(`/customers/${customerId}/${ns}/${duplicateId}/merge`, { target_id: survivorId })
    // The list this modal was opened from now holds a row that no longer
    // exists — tell the owning hook to refetch (the live list AND the
    // archived sub-fetch both listen for this).
    window.dispatchEvent(new CustomEvent(scope === 'location' ? LOCATIONS_CHANGED_EVENT : DEPARTMENTS_CHANGED_EVENT))
    notifySuccess(t(`${ns}.merge.done`))
  }

  return (
    <MergeEntityModal
      i18nPrefix={`${ns}.merge`}
      persistKey={`customer-merge-${scope}`}
      current={current}
      others={others}
      onClose={onClose}
      onMerged={onMerged}
      mergeRequest={mergeRequest}
    />
  )
}
