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
import { withIdempotencyKey } from '@/lib/idempotency'
import type { Id } from '@/types/common'

export interface Proposal {
  id: Id
  recipient_name: string | null
  recipient_email: string | null
  cv_variant: 'proposal' | 'full'
  // K-248 PROPOSE-SEND-1: the delivery truth, stamped after the mailer reported
  // (null on rows older than the column — ProposalsBlock falls back to sent_at).
  send_status: 'queued' | 'sent' | 'failed' | 'no_consent' | 'not_sent' | null
  send_error: string | null
  // Mail delivery truth of THIS proposal mail (BE lane E); null/absent on rows filed before the column.
  delivery_status?: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed' | null
  undelivered?: boolean
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
  // VOORSTEL-AFZENDER-FE-1: the resolved sender at record time — null both for
  // proposals recorded before the field existed and for a stale/never-set default.
  // `name` itself can also be null: ApplicationProposalResource sends
  // `name => sender_name ?? null`, so a sender row with no stored name resolves
  // to an id-only object here — ProposalsBlock must not render a blank "sent by ".
  sender: { id: string; name: string | null } | null
}

// Poll backoff while a send is queued: 15 s, 30 s, then 60 s up to an honest cap (≈ 30 min in all).
export const PROPOSALS_POLL_DELAYS_MS: readonly number[] = [15_000, 30_000, ...Array.from({ length: 28 }, () => 60_000)]
// A queued row older than this (by sent_at) will not settle on its own any more: stop polling.
export const PROPOSALS_POLL_MAX_AGE_MS = 30 * 60_000

// Next poll delay, or false once nothing is queued, the cap is reached or every queued row is stale.
export function proposalsPollInterval(rows: Proposal[] | undefined, updateCount: number, now = Date.now()): number | false {
  const queued = rows?.filter(r => r.send_status === 'queued' || r.delivery_status === 'queued') ?? []
  if (queued.length === 0) return false
  const fresh = queued.some(r => !r.sent_at || now - new Date(r.sent_at).getTime() < PROPOSALS_POLL_MAX_AGE_MS)
  if (!fresh) return false
  return PROPOSALS_POLL_DELAYS_MS[Math.max(0, updateCount - 1)] ?? false
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
    // A queued send settles on its own: poll with backoff and a cap while one is in flight.
    refetchInterval: query => proposalsPollInterval(query.state.data, query.state.dataUpdateCount),
  })

  // Revoke is idempotent server-side; invalidate the list on success so the
  // revoked state (and the removed revoke button) reflects immediately.
  const revokeMutation = useMutation({
    // Revoke is user-triggered and feels irreversible: one Idempotency-Key per click.
    mutationFn: (proposalId: Id) => api.post(`/proposals/${proposalId}/revoke`, undefined, withIdempotencyKey()),
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
