import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

// The minimal shape every queued upload item must carry — a caller's own
// PendingItem (with extra fields like `file`/`name`/`size`, and optionally its
// own `linkTo`) satisfies this structurally without redeclaring it.
interface UploadQueueItemBase {
  objectUrl: string
  type: string
  // DOC-ENTRY-LINK-1: optional "kind:id" link pick — only the candidate queue
  // uses it; a caller without the concept (customers) simply omits the field,
  // which still satisfies this optional constraint.
  linkTo?: string
}

interface UseUploadQueueItemsResult<T extends UploadQueueItemBase> {
  pending: T[]
  setPending: Dispatch<SetStateAction<T[]>>
  setItemType: (idx: number, type: string) => void
  setAllTypes: (type: string) => void
  setItemLink: (idx: number, linkTo: string) => void
  removePending: (idx: number) => void
}

/**
 * useUploadQueueItems — the per-item actions shared by every "files queued
 * for upload" list (candidate + customer document tabs): set one item's doc
 * type, set one item's "Koppelen aan" link pick, and drop one item while
 * revoking its blob preview URL. Pure state logic, no DOM. `removePending`
 * revokes the ORIGINAL item's blob URL before the filtered array replaces
 * `pending` (matches HEAD order exactly — see the accompanying test), so a
 * dropped preview never leaks.
 */
export function useUploadQueueItems<T extends UploadQueueItemBase>(initial: T[] = []): UseUploadQueueItemsResult<T> {
  const [pending, setPending] = useState<T[]>(initial)

  // Set one item's doc type (its own select) without touching the others.
  const setItemType = (idx: number, type: string) =>
    setPending(items => items.map((it, i) => (i === idx ? { ...it, type } : it)))

  // Give every queued item the same doc type (the "alle bestanden" chip row).
  const setAllTypes = (type: string) => setPending(items => items.map(it => ({ ...it, type })))

  // DOC-ENTRY-LINK-1: set one item's "Koppelen aan" pick without touching the others.
  const setItemLink = (idx: number, linkTo: string) =>
    setPending(items => items.map((it, i) => (i === idx ? { ...it, linkTo } : it)))

  // Drop one queued item and revoke its blob preview URL so it never leaks —
  // reads the target from the ORIGINAL array, before it is filtered out.
  const removePending = (idx: number) =>
    setPending(items => {
      const target = items[idx]
      if (target) URL.revokeObjectURL(target.objectUrl)
      return items.filter((_, i) => i !== idx)
    })

  return { pending, setPending, setItemType, setAllTypes, setItemLink, removePending }
}
