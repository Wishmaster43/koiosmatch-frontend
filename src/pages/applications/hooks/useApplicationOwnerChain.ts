/**
 * useApplicationOwnerChain — APPMODAL-SPLIT-1: the owner-derivation sub-region
 * for useAddApplicationForm (the drawer context). Delegates the APP-OWNER-1
 * chain to the shared useOwnerDerivation hook — behaviour unchanged.
 *
 * ADDAPPLICATION-TWIN-1: relocated verbatim from pages/candidates/hooks — this
 * is the candidate-drawer AddApplicationModal's own owner-derivation hook
 * (distinct from pages/applications/hooks/useApplicationOwnerAndStage, the
 * page-toolbar variant's equivalent, which also derives an owner but from a
 * PICKED candidate rather than a fixed candidateOwnerId prop). `VacancyOption`
 * comes from the candidates public surface (§2, `@/pages/candidates/shared`)
 * — a type-only import, erased at build time, so it carries no barrel
 * eager-load risk (see useApplicationModalLookups' doc comment for the
 * value-import case, which the candidate-drawer test mocks flat instead).
 *
 * DRY-OWNER-1: delegates the derivation logic to useOwnerDerivation (extracted
 * from both this and useApplicationOwnerAndStage — 0% behaviour change).
 */
import { useOwnerDerivation } from './useOwnerDerivation'
import type { Id } from '@/types/common'
import type { VacancyOption } from '@/pages/candidates/shared'

export function useApplicationOwnerChain({
  pickedVacancy, candidateOwnerId, userOptions, meId, meIsAssignable,
}: {
  pickedVacancy: VacancyOption | undefined
  candidateOwnerId?: Id | null
  userOptions: { value: string; label: string }[]
  meId?: Id
  meIsAssignable: boolean
}) {
  // Delegate the owner-derivation chain logic to the shared hook.
  return useOwnerDerivation({
    vacancyOwnerId: pickedVacancy?.ownerId,
    candidateOwnerId,
    meId,
    userOptions,
    meIsAssignable,
  })
}
