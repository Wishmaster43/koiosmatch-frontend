import type { Dispatch, SetStateAction } from 'react'
import api from '@/lib/api'
import { apiErrorCode } from '@/lib/extractApiError'

// Delete a lookup/status-list row against `${endpoint}/${item.id}`: an UNCODED 409
// means the row is still in use elsewhere (MarksLookupUsage aborts 409 without a
// code), so it stays in the list flagged `in_use` instead of being removed; a CODED
// 409 (task_status_last_row, TASK-STATUS-LAST-ROW-FE-1) is a refusal with its own
// translated sentence, so the row stays unflagged and `onError` receives the error
// for apiErrorMessage; any other failure calls `onError` too (§3: no silent catch).
// Shared so ProvincesSettings and StatusListEditor never drift on this
// confirm→delete→conflict flow (DRY).
export async function deleteLookupRow<T extends { id: string | number; in_use?: boolean }>(
  endpoint: string,
  item: T,
  setItems: Dispatch<SetStateAction<T[]>>,
  setDeleting: (id: string | number | null) => void,
  onError: (err: unknown) => void,
): Promise<void> {
  setDeleting(item.id)
  try {
    await api.delete(`${endpoint}/${item.id}`)
    setItems(p => p.filter(x => x.id !== item.id))
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 409 && apiErrorCode(e) === null) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
    else onError(e)
  } finally {
    setDeleting(null)
  }
}
