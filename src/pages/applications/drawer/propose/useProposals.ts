/**
 * useProposals — the recorded-proposal HISTORY for one application (§3A: logic
 * in hooks). Mirrors useCandidateCvDocument's React Query (K-33) shape: cached
 * per application id, only enabled once an id exists, GET the list and expose
 * a revoke() mutation that invalidates the same query key on success.
 *
 * The list resource never carries subject/body (PII minimisation, §8) — only
 * recipient name/email, cv variant, the open/revoke timestamps and (since
 * PROPOSE-SHARE-URL-1 shipped) the recipient-facing share link, which is
 * exactly what ProposalsBlock renders.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface Proposal {
  id: Id
  recipient_name: string | null
  recipient_email: string | null
  cv_variant: 'proposal' | 'full'
  sent_at: string | null
  revoked_at: string | null
  opened_at: string | null
  open_count: number
  is_valid: boolean
  // PROPOSE-SHARE-URL-1: the signed, recipient-facing link + its expiry. The
  // backend only attaches these for a viewer who may write (applications.update)
  // and nulls both once the proposal is revoked — a read-only viewer or a
  // revoked proposal never receives a working link from the API itself.
  share_url: string | null
  share_expires_at: string | null
}

export function useProposals(applicationId: Id | null | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['applications', applicationId, 'proposals']

  // The proposal history — enabled only once an application id is known.
  const { data, isLoading, isError } = useQuery({
    queryKey,
    enabled: applicationId != null,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<Proposal>(await api.get(`/applications/${applicationId}/proposals`, { signal }))
      return rows
    },
  })

  // Revoke is idempotent server-side; invalidate the list on success so the
  // revoked state (and the removed revoke button) reflects immediately.
  const revokeMutation = useMutation({
    mutationFn: (proposalId: Id) => api.post(`/proposals/${proposalId}/revoke`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    proposals: data ?? [],
    loading: applicationId != null && isLoading,
    error: applicationId != null && isError,
    revoke: (proposalId: Id) => revokeMutation.mutateAsync(proposalId),
    revoking: revokeMutation.isPending,
  }
}
