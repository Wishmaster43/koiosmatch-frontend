/**
 * AddApplicationModal ("+ Solliciteren", candidate drawer) — thin adapter onto
 * the merged pages/applications/AddApplicationModal (ADDAPPLICATION-TWIN-1: the
 * former candidate-only implementation, its two form hooks and its "Extra"
 * custom-fields section now live there as the 'drawer' context). This file only
 * forwards the props it always took, unchanged — the drawer's look and
 * behaviour stay frozen (§14 SCHERMWAARHEID-1). Kept at this path so
 * pages/candidates/shared.ts's existing `CandidateAddApplicationModal`
 * re-export (and every deep test mock targeting this exact path) keeps working
 * without a call-site change.
 */
import { AddApplicationModal as SharedAddApplicationModal } from '@/pages/applications/shared'
import type { Id } from '@/types/common'

export default function AddApplicationModal({ candidateId, candidateOwnerId, candidateOwnerName, initialVacancyId, suggestedVacancyId, editApplicationId, onClose, onCreated }: {
  candidateId: Id
  candidateOwnerId?: Id | null
  candidateOwnerName?: string
  initialVacancyId?: Id
  suggestedVacancyId?: Id | null
  editApplicationId?: Id
  onClose: () => void
  onCreated: () => void
}) {
  return (
    <SharedAddApplicationModal context="drawer" candidateId={candidateId} candidateOwnerId={candidateOwnerId}
      candidateOwnerName={candidateOwnerName} initialVacancyId={initialVacancyId} suggestedVacancyId={suggestedVacancyId}
      editApplicationId={editApplicationId} onClose={onClose} onCreated={onCreated} />
  )
}
