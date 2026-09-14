import type { Dispatch, SetStateAction } from 'react'
import api from '@/lib/api'

// Delete a lookup/status-list row against `${endpoint}/${item.id}`: a 409 means
// the row is still in use elsewhere, so it stays in the list flagged `in_use`
// instead of being removed; any other failure calls `onError` (§3: no silent
// catch). Shared so ProvincesSettings and StatusListEditor never drift on this
// confirm→delete→conflict flow (DRY).
export async function deleteLookupRow<T extends { id: string | number; in_use?: boolean }>(
  endpoint: string,
  item: T,
  setItems: Dispatch<SetStateAction<T[]>>,
  setDeleting: (id: string | number | null) => void,
  onError: () => void,
): Promise<void> {
  setDeleting(item.id)
  try {
    await api.delete(`${endpoint}/${item.id}`)
    setItems(p => p.filter(x => x.id !== item.id))
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 409) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
    else onError()
  } finally {
    setDeleting(null)
  }
}
