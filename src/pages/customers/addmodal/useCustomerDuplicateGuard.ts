/**
 * useCustomerDuplicateGuard — CUST-DUP-FE-1 (22-08): bundles the create modal's
 * duplicate wiring (live probe + create-409 verdict + restore + cross-entity
 * navigation) behind one hook, mirroring AddCandidateModal's own
 * dupBlock/dupNotice/openExisting/restoreAndOpen glue — just moved off the
 * container so AddCustomerModal stays under the ~400-line split trigger (§0.3).
 */
import { useState } from 'react'
import { useNavigation } from '@/context/NavigationContext'
import { useCustomerDuplicateProbe, useRestoreCustomerDuplicate } from './useCustomerDuplicateProbe'
import type { DuplicateMatch } from '@/components/forms/DuplicateNotice'
import type { Id } from '@/types/common'

export function useCustomerDuplicateGuard(name: string, cocNumber: string, billingEmail: string, onClose: () => void) {
  // Cross-entity jump to an existing customer (house pattern, mirrors AddCandidateModal).
  const { openEntity } = useNavigation()
  const { restore, restoring } = useRestoreCustomerDuplicate()
  // The duplicate the server REFUSED the create on (409 `existing`) — mirrors
  // AddCandidateModal's C-29 dupBlock exactly.
  const [dupBlock, setDupBlock] = useState<DuplicateMatch | null>(null)
  // Live "warn while you type" probe over the create form's own dedupe-relevant fields.
  const { probeMatch, clearProbeMatch } = useCustomerDuplicateProbe(name, cocNumber, billingEmail)
  // The blocked panel (create 409) takes priority over the ambient live-probe warning.
  const notice = dupBlock ?? probeMatch
  const dismiss = () => { setDupBlock(null); clearProbeMatch() }
  // Leave the create form and open the existing record (nothing was created here).
  const openExisting = (id: Id) => { onClose(); openEntity('customers', id) }
  // Archived duplicate: bring it back, then open it. Restore is permission-gated in
  // the UI and re-checked by the backend (§7).
  const restoreAndOpen = async (id: Id) => { if (await restore(id)) openExisting(id) }
  // Any field edit invalidates the refused-create verdict and the last probe hit —
  // the next submit / debounce re-asks the server, which stays the only authority.
  const clearOnEdit = () => { setDupBlock(null); clearProbeMatch() }

  return { notice, blocked: dupBlock != null, restoring, setDupBlock, dismiss, openExisting, restoreAndOpen, clearOnEdit }
}
