/**
 * useCvParseProposals — the CV-parse proposals attached to ONE application
 * (CV-PARSER-2, entry b). Logic in a hook (§3); the block below only renders.
 *
 * MEASURED CONTRACT (routes/api/tenant/candidates.php:63-65):
 *   GET  /candidates/{candidate}/cv-parse-proposals                   candidates.view
 *   POST /candidates/{candidate}/cv-parse-proposals/{proposal}/accept candidates.update
 *   POST /candidates/{candidate}/cv-parse-proposals/{proposal}/reject candidates.update
 * Both decision routes take NO request body — the merge rule lives entirely in
 * CvParseProposalApplier — so this hook posts none. There is no per-field accept
 * route: accept is all-or-nothing, fill-blank-only. The UI therefore SHOWS the
 * per-field outcome instead of offering a per-field toggle it cannot honour.
 *
 * The list route is candidate-scoped, so we filter to this application ourselves.
 *
 * The candidate's CURRENT values (needed to show "what it is now") are fetched
 * ONLY when a pending proposal actually exists — no pending decision, no extra
 * personal data over the wire (§8 data minimisation).
 *
 * Nothing here logs: both the proposal payload and the candidate record are
 * special-category personal data (§8).
 */
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { mapCvProposal } from '@/pages/applications/data/mapCvProposal'
import type { ApiCvParseProposal, CvProposal } from '@/pages/applications/data/mapCvProposal'
import type { Id } from '@/types/common'

export type CvProposalDecision = 'accept' | 'reject'

export function useCvParseProposals(candidateId: Id | null | undefined, applicationId: Id | null | undefined) {
  const auth = useAuth()
  const canView = auth?.hasPermission?.('candidates.view') ?? false
  // Accept/reject WRITE candidate data — the backend gates them on candidates.update
  // and re-checks; gating here only keeps us from rendering a control that 403s.
  const canDecide = auth?.hasPermission?.('candidates.update') ?? false
  const queryClient = useQueryClient()
  // The accept RESPONSE carries applied_fields/skipped_fields (set by the
  // controller, never persisted), so keep the last decision to report what landed.
  const [lastDecided, setLastDecided] = useState<CvProposal | null>(null)

  const listKey = useMemo(() => ['candidates', candidateId, 'cv-parse-proposals'], [candidateId])

  // The candidate's proposals, newest first (server order). Disabled without the
  // read permission so a read-only viewer never fires a guaranteed 403.
  const list = useQuery({
    queryKey: listKey,
    enabled: candidateId != null && applicationId != null && canView,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<ApiCvParseProposal>(
        await api.get(`/candidates/${candidateId}/cv-parse-proposals`, { signal }),
      )
      return rows.map(mapCvProposal)
    },
  })

  // Only THIS application's proposals — the endpoint is candidate-scoped, so a
  // second application's CV would otherwise surface on the wrong drill-down.
  const proposals = useMemo(
    () => (list.data ?? []).filter(p => applicationId != null && String(p.applicationId) === String(applicationId)),
    [list.data, applicationId],
  )
  const hasPending = proposals.some(p => p.status === 'pending')

  // Current candidate values for the diff — fetched only when a decision is
  // actually pending (§8). The raw body is used as-is: buildCvProposalDiff reads
  // the same field names the applier writes, so no lossy UI mapping sits between.
  const current = useQuery({
    queryKey: ['candidates', candidateId, 'cv-parse-proposal-current'],
    enabled: candidateId != null && canView && hasPending,
    queryFn: async ({ signal }) =>
      unwrap<Record<string, unknown>>(await api.get(`/candidates/${candidateId}`, { signal })),
  })

  // One decision mutation for both routes — same shape, same invalidation.
  const decision = useMutation({
    mutationFn: async ({ proposalId, verb }: { proposalId: Id; verb: CvProposalDecision }) =>
      mapCvProposal(
        unwrap<ApiCvParseProposal>(
          await api.post(`/candidates/${candidateId}/cv-parse-proposals/${proposalId}/${verb}`),
        ),
      ),
    onSuccess: decided => {
      setLastDecided(decided)
      // Accepting writes candidate data — drop every cached view of this
      // candidate, not just the proposal list, so the drawer stops showing stale
      // "current" values a moment after they changed.
      queryClient.invalidateQueries({ queryKey: ['candidates', candidateId] })
    },
  })

  // Decide one proposal. Rejects on failure so the caller can surface the error
  // (never a silent no-op that looks like it worked).
  const decide = useCallback(
    (proposalId: Id, verb: CvProposalDecision) => decision.mutateAsync({ proposalId, verb }),
    [decision],
  )

  return {
    proposals,
    loading: candidateId != null && applicationId != null && canView && list.isLoading,
    error: candidateId != null && applicationId != null && canView && list.isError,
    /** The candidate's current record — null until loaded; drives the diff. */
    currentCandidate: (current.data ?? null) as Record<string, unknown> | null,
    currentLoading: hasPending && current.isLoading,
    currentError: hasPending && current.isError,
    canDecide,
    decide,
    deciding: decision.isPending,
    lastDecided,
  }
}
