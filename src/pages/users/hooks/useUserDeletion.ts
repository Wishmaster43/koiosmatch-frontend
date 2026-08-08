/**
 * useUserDeletion — the two-step soft-delete flow for a tenant user
 * (USER-SOFTDELETE-1). A user who still OWNS records may never be cut loose from
 * them, so the backend answers the plain `DELETE /users/{id}` with **422 +
 * `{requires_transfer: true, owned: {total, by_type}}`** instead of deleting.
 *
 * Measured live 09-08 against koiosmatch-api (yesway):
 *   DELETE /users/{id}                                    → 422
 *     {"message":"…","requires_transfer":true,
 *      "owned":{"total":1,"by_type":{"tasks":1}}}
 *   DELETE /users/{id}  body {"transfer_to_user_id":"…"}  → 200
 *     {"message":"User deleted","transferred":{"tasks":1}}
 *
 * That 422 is therefore NOT an error to report — it is the hand-off signal that
 * opens the transfer dialog. Only a 422 WITHOUT `requires_transfer` (e.g. "you
 * cannot delete your own account") is a real failure and surfaces as a message.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { ManagedUser } from '@/types/api'

// The backend's ownership summary: a grand total plus a per-object-type count.
// Keys are tenant TABLE names (candidates, vacancies, tasks, …) — see
// UserOwnershipTransfer::OWNERSHIP_MAP; the dialog translates them.
export interface OwnedSummary {
  total: number
  by_type: Record<string, number>
}

// Shape of the 422 body that asks for a successor before the delete may proceed.
interface TransferRequiredBody {
  requires_transfer?: boolean
  owned?: OwnedSummary
}

export function useUserDeletion(onDeleted: (userId: string) => void) {
  const { t } = useTranslation('users')
  // The user held back at the transfer gate (null = no dialog open).
  const [target, setTarget] = useState<ManagedUser | null>(null)
  const [owned, setOwned] = useState<OwnedSummary | null>(null)
  const [busy, setBusy] = useState(false)

  // Drop the pending transfer without deleting anything.
  const close = () => { setTarget(null); setOwned(null) }

  // Step 1 — try the plain soft-delete. A 422 carrying `requires_transfer` opens
  // the transfer dialog with the server's own counts; every other failure is a
  // real error and gets the server message (never a raw axios string).
  const requestDelete = async (user: ManagedUser) => {
    setBusy(true)
    try {
      await api.delete(`/users/${user.id}`)
      onDeleted(String(user.id))
      notifySuccess(t('delete.done'))
    } catch (err) {
      const res = (err as { response?: { status?: number; data?: TransferRequiredBody } }).response
      if (res?.status === 422 && res.data?.requires_transfer) {
        setTarget(user)
        setOwned(res.data.owned ?? { total: 0, by_type: {} })
      } else {
        notifyError(extractApiError(err, t('delete.failed')))
      }
    } finally {
      setBusy(false)
    }
  }

  // Step 2 — repeat the SAME delete with the chosen successor in the request
  // BODY (axios carries a DELETE body under `data`). The backend moves every
  // ownership link in one transaction before it soft-deletes, so no record is
  // ever orphaned. The dialog stays open on failure so the choice isn't lost.
  const confirmTransfer = async (successorId: string) => {
    if (!target) return
    setBusy(true)
    try {
      await api.delete(`/users/${target.id}`, { data: { transfer_to_user_id: successorId } })
      onDeleted(String(target.id))
      notifySuccess(t('delete.transferred'))
      close()
    } catch (err) {
      notifyError(extractApiError(err, t('delete.failed')))
    } finally {
      setBusy(false)
    }
  }

  return { target, owned, busy, requestDelete, confirmTransfer, close }
}
