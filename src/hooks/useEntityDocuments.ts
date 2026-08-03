/**
 * useEntityDocuments — a customer/vacancy's file attachments, wired to the shared
 * EntityDocumentController (G-3/G-4). Loads the list (GET index) and does optimistic
 * upload/rename/delete against /{prefix}/{id}/documents, reconciling each with the
 * server row (real UUID id + short-lived signed download_url). Mirror of the note-pad
 * pattern (§3 — one shared hook, both entities). Contract per doc:
 *   { id (uuid), name, type, size, url, download_url, created_at }
 * `url` = authenticated stream (needs the session); `download_url` = signed capability
 * URL (absolute, ~5 min TTL) — the FE opens THAT for preview, never the relative `url`.
 *
 * DOCS-LOC-DEPT-1: `listUrl` optionally OVERRIDES the GET listing endpoint — the
 * customer's location/department drill-down (ScopedDocumentsTab) reads through the
 * byLocation/byDepartment routes instead of the flat customer list, while every
 * write (upload/rename/delete) still targets the customer's own `/customers/{id}/
 * documents` routes (the only ones that exist — a document's parent is always the
 * customer, the location/department id is a secondary link, never a route segment).
 * `upload()`'s optional 5th argument carries that same link as extra multipart
 * fields (e.g. `{ customer_location_id: '...' }`) — omitted entirely (not merely
 * undefined) when there is nothing to link, so an unlinked upload's request body
 * is byte-identical to before this axis existed.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList, unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Id } from '@/types/common'

export interface EntityDoc {
  id?: Id; name?: string; file_name?: string; type?: string
  size?: string | number; url?: string; download_url?: string
  objectUrl?: string; created_at?: string
  // Uploader/creation metadata (type-only for now — backend emits the name later,
  // ticket DOC-UPLOADER-1; render tolerantly against both shapes in the meantime).
  uploaded_by?: string | { name?: string }; created_by?: string | { name?: string }
  uploaded_at?: string
  // DOCS-LOC-DEPT-1: the OPTIONAL location/department link + the backend's own
  // resolved `level` (only CustomerDocument carries these — see EntityDocumentController::
  // payload()'s levelContext() spread; absent on every other entity's documents).
  level?: string
  customer_location_id?: Id | null; location_name?: string | null
  customer_department_id?: Id | null; department_name?: string | null
}

// A persisted doc has a real (UUID) id; an optimistic row carries a `tmp-…` id.
const isTemp = (id: Id | undefined) => typeof id === 'string' && id.startsWith('tmp-')

// Monotonic counter behind every temp id. `Date.now()` alone was NOT unique: picking
// several files at once fires upload() for each within the same millisecond, so every
// optimistic row got the SAME id (Danny 28-07). Everything downstream keys on that id,
// so one collision produced three visible failures at once — the selection Set collapsed
// to a single entry ("Verwijder (1)" with five rows ticked), the server's reply overwrote
// EVERY row sharing the id (the same file listed five times), and bulk-delete then fired
// the same DELETE repeatedly, the second one hitting an already-removed document → 404.
let tempDocSeq = 0

// Render bytes as a compact KB/MB string; pass strings through (optimistic rows).
const fmtSize = (s: string | number | undefined): string => {
  if (typeof s === 'string') return s
  if (typeof s !== 'number' || !isFinite(s)) return ''
  return s >= 1_048_576 ? (s / 1_048_576).toFixed(1) + ' MB' : Math.max(1, Math.round(s / 1024)) + ' KB'
}

export function useEntityDocuments(prefix: string, parentId: Id | undefined, listUrl?: string) {
  const { t } = useTranslation()
  const [docs, setDocs] = useState<EntityDoc[]>([])

  // Load the list (server returns newest-first) whenever the parent (or, for a
  // scoped drill-down, the DOCS-LOC-DEPT-1 listUrl override) changes.
  useEffect(() => {
    if (!parentId) { setDocs([]); return }
    let alive = true
    api.get(listUrl ?? `/${prefix}/${parentId}/documents`)
      .then(res => { if (alive) setDocs(unwrapList<EntityDoc>(res).rows.map(d => ({ ...d, size: fmtSize(d.size) }))) })
      .catch(() => { if (alive) setDocs([]) })
    return () => { alive = false }
  }, [prefix, parentId, listUrl])

  // Upload (multipart) — optimistic row with a temp id, swapped for the server doc.
  // DOCS-LOC-DEPT-1: `extraFields` (e.g. `{ customer_location_id: '...' }`) rides
  // along as extra FormData fields when given — omitted entirely when absent, so
  // an unlinked upload's request body never gains a stray empty field.
  const upload = useCallback((file: File, type: string, name: string, objectUrl: string, extraFields?: Record<string, string>) => {
    if (!parentId) return
    const tmpId = `tmp-${Date.now()}-${++tempDocSeq}`
    setDocs(d => [{ id: tmpId, name, type, size: fmtSize(file.size), objectUrl }, ...d])
    const fd = new FormData()
    fd.append('file', file); fd.append('type', type); fd.append('name', name)
    Object.entries(extraFields ?? {}).forEach(([k, v]) => fd.append(k, v))
    api.post(`/${prefix}/${parentId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      // Audit R1 🔴: the optimistic row's object URL leaked on every upload — revoke it
      // the moment the server doc replaces (or the failure drops) the temp row.
      .then(res => { const saved = unwrap<EntityDoc>(res); if (objectUrl) URL.revokeObjectURL(objectUrl); setDocs(d => d.map(x => x.id === tmpId ? { ...saved, size: fmtSize(saved.size) } : x)) })
      .catch(() => { if (objectUrl) URL.revokeObjectURL(objectUrl); setDocs(d => d.filter(x => x.id !== tmpId)); notifyError(t('common:actionFailed')) })
  }, [prefix, parentId, t])

  // Rename — optimistic, reverts on failure. A temp (not-yet-persisted) row skips the PATCH.
  const rename = useCallback((id: Id | undefined, name: string) => {
    if (!parentId || id == null) return
    const snapshot = docs
    setDocs(d => d.map(x => x.id === id ? { ...x, name } : x))
    if (isTemp(id)) return
    api.patch(`/${prefix}/${parentId}/documents/${id}`, { name })
      .catch(() => { setDocs(snapshot); notifyError(t('common:actionFailed')) })
  }, [prefix, parentId, docs, t])

  // Delete — optimistic remove, reverts on failure. A temp row just drops locally.
  const remove = useCallback((id: Id | undefined) => {
    if (!parentId || id == null) return
    // Revert surgically, never by restoring the whole list: bulk-delete calls this once
    // per row, and a snapshot-restore on the second failure would resurrect the rows the
    // earlier calls had already deleted successfully.
    const index = docs.findIndex(x => x.id === id)
    const row = index >= 0 ? docs[index] : null
    setDocs(d => d.filter(x => x.id !== id))
    if (isTemp(id)) return
    api.delete(`/${prefix}/${parentId}/documents/${id}`)
      .catch((err: { response?: { status?: number } }) => {
        // A 404 means the document is already gone — the caller's goal state. Restoring
        // the row and shouting "mislukt" would be a lie about what the server holds.
        if (err?.response?.status === 404) return
        if (row) setDocs(d => { const next = [...d]; next.splice(Math.min(index, next.length), 0, row); return next })
        notifyError(t('common:actionFailed'))
      })
  }, [prefix, parentId, docs, t])

  return { docs, upload, rename, remove }
}
