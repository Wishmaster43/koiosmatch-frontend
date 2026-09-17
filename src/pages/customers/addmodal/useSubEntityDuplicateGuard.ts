/**
 * useSubEntityDuplicateGuard — CUST-STAMDATA-DUP-1 (ADOPT-A2 row 81, contract
 * SETTINGS-INCONSISTENCIES-BE-1): the live "warn while you type" duplicate probe
 * for a customer's own locations/departments/contacts, mirroring
 * useCustomerDuplicateGuard.ts 1:1 (same debounce/abort-on-edit shape via the
 * shared hooks/useDuplicateProbe) but scoped to one customer via
 * `/customers/{customerId}/{entity}/check-duplicate` (DUP-STAMDATA-1). Advisory
 * only — the notice never blocks submit, the server 422/409 stays the real gate.
 *
 * ADOPT-A2-VERIFY-FIX: callers pass `customerId={isEdit ? undefined : customerId}`
 * so the probe never fires while editing — the form is pre-filled from `initial`
 * there, and probing would match the record against itself (§8 data minimisation,
 * §9). No `exclude_id` support is needed as a result.
 *
 * restore() mirrors useCustomerDuplicateGuard's own restoreAndOpen: the per-id
 * route (§10) `/customers/{customerId}/{entity}/{id}/restore` exists on the
 * backend for all three sub-entities (routes/api/tenant/customers.php), so an
 * archived duplicate hit gets a REAL restore affordance, not a dead hint.
 */
import { useState } from 'react'
import { useSafePermission } from '@/hooks/useSafePermission'
import { LOCATIONS_CHANGED_EVENT } from '../hooks/useCustomerLocations'
import { DEPARTMENTS_CHANGED_EVENT } from '../hooks/useCustomerDepartments'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useDuplicateProbe } from '@/hooks/useDuplicateProbe'
import type { DuplicateMatch } from '@/components/forms/DuplicateNotice'
import type { Id } from '@/types/common'

type SubEntity = 'locations' | 'departments' | 'contacts'

// Which list-change event announces a restored record, per sub-entity route segment.
const CHANGED_EVENT = { locations: LOCATIONS_CHANGED_EVENT, departments: DEPARTMENTS_CHANGED_EVENT, contacts: CONTACTS_CHANGED_EVENT } as const

export function useSubEntityDuplicateGuard(
  entity: SubEntity,
  customerId: Id | undefined,
  keys: readonly [string, string, string],
  a: string, b: string, c: string,
  /** Opens the existing row within the current tab (e.g. the tab's own setOpenId).
   * The second arg tells the caller the hit is archived, so it can flip its own
   * quick-view before opening — otherwise the id is absent from the loaded rows
   * and the "open" click does nothing. */
  onOpenExisting?: (id: Id, archived?: boolean) => void,
  /** Pre-translated toast text (caller's own t(), mirrors useRestoreArchivedDuplicate's
   * `messages` — this shared hook carries no i18n namespace of its own). */
  messages?: { restoreFailed: string; restoreForbidden: string },
) {
  const path = customerId ? `/customers/${customerId}/${entity}/check-duplicate` : ''
  // The probe never fires without a customerId (path stays empty, base hook no-ops on blank values only —
  // guard the inputs too so an unmounted-customer create modal never probes).
  const { probeMatch, clearProbeMatch } = useDuplicateProbe<DuplicateMatch>(path, keys, customerId ? a : '', customerId ? b : '', customerId ? c : '')
  const hasPermission = useSafePermission()
  const [dismissed, setDismissed] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const notice = dismissed ? null : probeMatch
  const dismiss = () => { setDismissed(true); clearProbeMatch() }
  // Any further edit re-arms the notice for the next probe hit.
  const clearOnEdit = () => setDismissed(false)
  const openExisting = (id: Id) => onOpenExisting?.(id, notice?.archived === true)

  // Restore the archived duplicate via its per-id route, then open it — permission-
  // gated in the UI (the backend re-checks). Mirrors useRestoreArchivedDuplicate.
  const restore = async (id: Id) => {
    if (!customerId) return
    setRestoring(true)
    try {
      await api.post(`/customers/${customerId}/${entity}/${id}/restore`)
      // The live lists refetch only on their own change event (useAbortableListLoad), so the
      // restored record must be announced before it is opened, or it never appears.
      window.dispatchEvent(new CustomEvent(CHANGED_EVENT[entity]))
      onOpenExisting?.(id, false)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (messages) notifyError(status === 403 ? messages.restoreForbidden : messages.restoreFailed)
    } finally {
      setRestoring(false)
    }
  }

  // Restore is a customers.update action on the backend (routes/api/tenant/customers.php):
  // the affordance only renders for a user who may perform it (§3 no fake affordance).
  const canRestore = notice?.archived === true && hasPermission('customers.update')

  return { notice, dismiss, clearOnEdit, openExisting, restore, restoring, canRestore }
}
