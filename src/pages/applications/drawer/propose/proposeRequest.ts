/**
 * proposeRequest — Y-002 PROPOSAL-CV-ATTACH-1: POST /applications/{id}/propose is
 * multipart/form-data. Scalars travel as strings (booleans as '1'/'0'), plus `cv_pdf`,
 * the client-rendered PDF (application/pdf, one file, at most 5 MB), so the server
 * attaches the exact CV the recruiter sees. The browser ALWAYS sends the file.
 */
import api from '@/lib/api'
import { withIdempotencyKey } from '@/lib/idempotency'

// The route's cap. The uploadPolicy store publishes no `proposal_cv` surface, so the constant is the source.
export const PROPOSAL_CV_MAX_BYTES = 5 * 1024 * 1024

// Scalar fields of the propose request; undefined and null are omitted from the form.
export interface ProposeFields {
  contact_id: string
  cv_variant: string
  subject: string
  body: string
  send: boolean
  sender_user_id?: string | null
  force?: boolean
}

// Raised before any request when the rendered CV exceeds the cap.
export class ProposalCvTooLargeError extends Error {
  constructor() { super('proposal_cv_too_large'); this.name = 'ProposalCvTooLargeError' }
}

// Refuses an oversized CV client-side (the server would answer 422 anyway).
export function assertProposalCvSize(blob: Blob): void {
  if (blob.size > PROPOSAL_CV_MAX_BYTES) throw new ProposalCvTooLargeError()
}

// Builds the multipart body: strings as is, booleans as '1'/'0', cv_pdf as a named PDF File.
export function buildProposeFormData(fields: ProposeFields, cvPdf: Blob, fileLabel: string): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue
    form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  // The server ignores the client name, but a multipart file part needs one.
  form.append('cv_pdf', new File([cvPdf], `cv-${fileLabel}-${fields.cv_variant}.pdf`, { type: 'application/pdf' }))
  return form
}

// One fresh Idempotency-Key per call; axios derives the multipart boundary itself (as useCvParse does).
export function postPropose(applicationId: string | number, fields: ProposeFields, cvPdf: Blob) {
  return api.post(`/applications/${applicationId}/propose`, buildProposeFormData(fields, cvPdf, String(applicationId)), withIdempotencyKey({ quietStatuses: [409] }))
}
