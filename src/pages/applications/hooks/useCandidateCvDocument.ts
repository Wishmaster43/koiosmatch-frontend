/**
 * useCandidateCvDocument — S31: the linked candidate's CV document(s) for the
 * application drawer's Sollicitatie tab. Fetches the dedicated, data-minimal
 * GET /candidates/{id}/documents endpoint (never the full candidate record just
 * to show a filename) and filters to type === 'CV' (the seeded document-type
 * slug, see useDocumentTypes' DEFAULT_DOCUMENT_TYPES). Server order is already
 * newest-first (CandidateDocumentController::index orders by created_at desc).
 *
 * React Query (K-33): cached per candidate id, only enabled once a candidate is
 * actually linked (data minimisation, §8/§9).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface CvDocument {
  id?: Id
  name?: string
  type?: string
  size?: string | number
  url?: string
  download_url?: string
  created_at?: string
  uploaded_at?: string
}

const isCv = (type?: string) => (type ?? '').trim().toLowerCase() === 'cv'

export function useCandidateCvDocument(candidateId: Id | null | undefined) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['candidates', candidateId, 'documents', 'cv'],
    enabled: candidateId != null,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<CvDocument>(await api.get(`/candidates/${candidateId}/documents`, { signal }))
      return rows.filter(d => isCv(d.type))
    },
  })

  return { cvDocuments: data ?? [], loading: candidateId != null && isLoading, error: candidateId != null && isError }
}
