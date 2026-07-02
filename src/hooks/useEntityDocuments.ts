/**
 * useEntityDocuments — a customer/vacancy's file attachments, wired to the shared
 * EntityDocumentController (G-3/G-4). Loads the list (GET index) and does optimistic
 * upload/rename/delete against /{prefix}/{id}/documents, reconciling each with the
 * server row (real UUID id + short-lived signed download_url). Mirror of the note-pad
 * pattern (§3 — one shared hook, both entities). Contract per doc:
 *   { id (uuid), name, type, size, url, download_url, created_at }
 * `url` = authenticated stream (needs the session); `download_url` = signed capability
 * URL (absolute, ~5 min TTL) — the FE opens THAT for preview, never the relative `url`.
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
}

// A persisted doc has a real (UUID) id; an optimistic row carries a `tmp-…` id.
const isTemp = (id: Id | undefined) => typeof id === 'string' && id.startsWith('tmp-')

// Render bytes as a compact KB/MB string; pass strings through (optimistic rows).
const fmtSize = (s: string | number | undefined): string => {
  if (typeof s === 'string') return s
  if (typeof s !== 'number' || !isFinite(s)) return ''
  return s >= 1_048_576 ? (s / 1_048_576).toFixed(1) + ' MB' : Math.max(1, Math.round(s / 1024)) + ' KB'
}

export function useEntityDocuments(prefix: string, parentId: Id | undefined) {
  const { t } = useTranslation()
  const [docs, setDocs] = useState<EntityDoc[]>([])

  // Load the list (server returns newest-first) whenever the parent changes.
  useEffect(() => {
    if (!parentId) { setDocs([]); return }
    let alive = true
    api.get(`/${prefix}/${parentId}/documents`)
      .then(res => { if (alive) setDocs(unwrapList<EntityDoc>(res).rows.map(d => ({ ...d, size: fmtSize(d.size) }))) })
      .catch(() => { if (alive) setDocs([]) })
    return () => { alive = false }
  }, [prefix, parentId])

  // Upload (multipart) — optimistic row with a temp id, swapped for the server doc.
  const upload = useCallback((file: File, type: string, name: string, objectUrl: string) => {
    if (!parentId) return
    const tmpId = `tmp-${Date.now()}`
    setDocs(d => [{ id: tmpId, name, type, size: fmtSize(file.size), objectUrl }, ...d])
    const fd = new FormData()
    fd.append('file', file); fd.append('type', type); fd.append('name', name)
    api.post(`/${prefix}/${parentId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => { const saved = unwrap<EntityDoc>(res); setDocs(d => d.map(x => x.id === tmpId ? { ...saved, size: fmtSize(saved.size) } : x)) })
      .catch(() => { setDocs(d => d.filter(x => x.id !== tmpId)); notifyError(t('common:actionFailed')) })
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
    const snapshot = docs
    setDocs(d => d.filter(x => x.id !== id))
    if (isTemp(id)) return
    api.delete(`/${prefix}/${parentId}/documents/${id}`)
      .catch(() => { setDocs(snapshot); notifyError(t('common:actionFailed')) })
  }, [prefix, parentId, docs, t])

  return { docs, upload, rename, remove }
}
