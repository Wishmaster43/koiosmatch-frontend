// Upload-queue state for DocumentsTab: the pending (not-yet-uploaded) files, each
// with its own doc type, plus the actions that mutate that queue. Extracted
// mechanically from DocumentsTab (§3 split trigger, 28-08) — no behavior change.
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

// A queued-but-not-yet-uploaded file, each with its own document type (BUGFIX
// 23-07: a multi-file pick used to collapse to a single pending slot, so picking
// 5 files silently uploaded only 1 — now every picked file gets its own queue entry).
export interface PendingItem { file: File; objectUrl: string; name: string; size: string; type: string }

interface UseDocumentUploadQueueArgs {
  upload: (file: File, type: string, name: string, objectUrl: string, extra?: Record<string, string>) => void
  uploadExtraFields: Record<string, string> | undefined
  setUploadLink: (v: string) => void
}

// Owns the queued-file list and every action that touches it (add/type/remove/upload).
export function useDocumentUploadQueue({ upload, uploadExtraFields, setUploadLink }: UseDocumentUploadQueueArgs) {
  const [pending, setPending] = useState<PendingItem[]>([])
  // Mirrors `pending` so the unmount cleanup below reads the latest queue without
  // depending on it (§9: a blob URL never explicitly revoked leaks for the tab's lifetime).
  const pendingRef = useRef(pending)
  // Mirror in an effect — writing a ref during render trips react-hooks/refs.
  useEffect(() => { pendingRef.current = pending }, [pending])
  // Revoke any still-queued preview URLs on unmount (e.g. the drawer closes mid-pick).
  useEffect(() => () => { pendingRef.current.forEach(p => URL.revokeObjectURL?.(p.objectUrl)) }, [])

  // Send every queued file to the server — one upload() call per item, each with
  // its OWN type — so a multi-file pick uploads all of them, not just the first.
  // DOCS-LOC-DEPT-1: `uploadExtraFields` is only ever spread in when it actually
  // carries something — an unlinked upload keeps calling upload() with exactly
  // its original 4 arguments (never a stray 5th `undefined`).
  const uploadAll = () => {
    if (!pending.length) return
    const items = pending
    setPending([])
    for (const item of items) {
      if (uploadExtraFields) upload(item.file, item.type, item.name, item.objectUrl, uploadExtraFields)
      else upload(item.file, item.type, item.name, item.objectUrl)
    }
    // A fresh upload batch starts unlinked again unless the picker is used once more.
    setUploadLink('customer')
  }
  // Set one item's doc type (its own select) without touching the others.
  const setItemType = (idx: number, type: string) => setPending(items => items.map((it, i) => (i === idx ? { ...it, type } : it)))
  // Apply-to-all chip: set the SAME type on every queued item at once.
  const setAllTypes = (type: string) => setPending(items => items.map(it => ({ ...it, type })))
  // Drop one queued item and revoke its blob preview URL so it never leaks.
  const removePending = (idx: number) => setPending(items => {
    const target = items[idx]
    if (target) URL.revokeObjectURL(target.objectUrl)
    return items.filter((_, i) => i !== idx)
  })
  // Cancel the whole queue: revoke every blob URL, then clear.
  const cancelPending = () => { pending.forEach(p => URL.revokeObjectURL?.(p.objectUrl)); setPending([]) }
  // File-input change handler: every picked file becomes its own queue entry
  // (default type 'CV') — this is the actual bugfix: previously only files?.[0] was kept.
  const onFilesPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const items: PendingItem[] = files.map(file => ({
      file, objectUrl: URL.createObjectURL(file), name: file.name,
      size: Math.round(file.size / 1024) + ' KB', type: 'CV',
    }))
    setPending(prev => [...prev, ...items])
    e.target.value = ''
  }

  return { pending, uploadAll, setItemType, setAllTypes, removePending, cancelPending, onFilesPicked }
}
