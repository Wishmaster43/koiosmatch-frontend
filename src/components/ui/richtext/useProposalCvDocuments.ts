/**
 * useProposalCvDocuments — the saved, scan-clean proposal CVs of ONE application
 * (Y-002 PROPOSAL-CV-ATTACH-1): the choices for an `application_propose` action
 * item's `cv_document_id`. Reads GET /applications/{id}/documents (all documents,
 * no type filter server-side) and filters client-side. Hand-written shape: the
 * OpenAPI spec carries no 2xx schema for this route.
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

interface ApplicationDocumentRow {
  id?: Id
  name?: string
  type?: string
  scan_status?: 'pending' | 'clean' | 'rejected'
  created_at?: string
  uploaded_at?: string
}

export interface ProposalCvOption { id: string; label: string; uploadedAt: string | null }

interface Loaded { appId: Id; docs: ProposalCvOption[]; error: boolean }

// Fetches once per application id; the result is keyed by id so a fast id switch never shows the previous entity's answer.
export function useProposalCvDocuments(applicationId: Id | null | undefined, refreshKey: unknown = 0) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (applicationId == null || applicationId === '') return
    const ctrl = new AbortController()
    // Deferred into the promise chain so a synchronous client throw becomes the error state.
    Promise.resolve().then(async () => {
      const { rows } = unwrapList<ApplicationDocumentRow>(await api.get(`/applications/${applicationId}/documents`, { signal: ctrl.signal }))
      const docs = rows
        .filter(d => d.id != null && d.type === 'proposal_cv' && d.scan_status === 'clean')
        .map(d => ({ id: String(d.id), label: d.name ?? String(d.id), uploadedAt: d.uploaded_at ?? d.created_at ?? null }))
      if (!ctrl.signal.aborted) setLoaded({ appId: applicationId, docs, error: false })
    }).catch(() => {
      if (!ctrl.signal.aborted) setLoaded({ appId: applicationId, docs: [], error: true })
    })
    return () => ctrl.abort()
  }, [applicationId, refreshKey])

  const has = applicationId != null && applicationId !== ''
  // A refresh keeps the previous list on screen (no flash back to loading).
  const current = has && loaded?.appId === applicationId ? loaded : null
  return { docs: current?.docs ?? [], loading: has && current === null, error: current?.error ?? false }
}
