/**
 * proposalCvEnsureApi — PROPOSAL-CV-PANEL-1: the ONLY module that knows the route that stores a
 * client-rendered house-style proposal CV for an application (BE contract:
 * POST /applications/{id}/proposal-cv, multipart cv_pdf + cv_variant, 201 with the new document
 * row whose scan_status is always clean, the scan being synchronous). A contract deviation is a change in this file alone.
 * Hand-written shapes: the OpenAPI spec carries no 2xx schema for these routes.
 */
import api, { unwrap, unwrapList } from '@/lib/api'
import { withIdempotencyKey } from '@/lib/idempotency'
import type { Id } from '@/types/common'

export type ProposalCvVariant = 'proposal' | 'full'

// Raised when the stored row carries no id or is not scan-clean (the BE scan is synchronous, so this is a contract breach).
export class ProposalCvNotCleanError extends Error {
  constructor(public reason: 'rejected' | 'invalid') { super(`proposal_cv_${reason}`); this.name = 'ProposalCvNotCleanError' }
}

interface StoredRow { id?: Id; scan_status?: string }
interface DocumentRow extends StoredRow { type?: string }

// Uploads the rendered PDF (synchronous scan, CMBE 12-11: 201 with scan_status always clean); one fresh Idempotency-Key per call.
export async function storeProposalCv({ applicationId, blob, variant }: { applicationId: Id; blob: Blob; variant: ProposalCvVariant }): Promise<{ id: string; scanStatus: string }> {
  const form = new FormData()
  form.append('cv_pdf', new File([blob], `cv-${applicationId}-${variant}.pdf`, { type: 'application/pdf' }))
  form.append('cv_variant', variant)
  const row = unwrap<StoredRow>(await api.post(`/applications/${applicationId}/proposal-cv`, form, withIdempotencyKey()))
  if (row?.id == null || row.id === '') throw new ProposalCvNotCleanError('invalid')
  if (row.scan_status !== 'clean') throw new ProposalCvNotCleanError(row.scan_status === 'rejected' ? 'rejected' : 'invalid')
  return { id: String(row.id), scanStatus: row.scan_status }
}

// The newest scan-clean proposal CV already on the application, or null (rows are read newest-first by created date).
export async function findCleanProposalCv(applicationId: Id, signal?: AbortSignal): Promise<string | null> {
  const { rows } = unwrapList<DocumentRow & { created_at?: string; uploaded_at?: string }>(await api.get(`/applications/${applicationId}/documents`, { signal }))
  const clean = rows.filter(d => d.id != null && d.type === 'proposal_cv' && d.scan_status === 'clean')
    .sort((a, b) => String(b.uploaded_at ?? b.created_at ?? '').localeCompare(String(a.uploaded_at ?? a.created_at ?? '')))
  return clean[0]?.id != null ? String(clean[0].id) : null
}
