/**
 * ContractFormChip — the ONE soft-chip rendering for a match's Contractvorm
 * (contract_form) axis (MATCH-SOORT-1). Every surface that shows this value —
 * the matches list, MatchCard (candidate/vacancy drawer tabs), the match
 * detail's contract card — renders through this single component (CLAUDE.md
 * §3A/§11: one look, never four restyles). Renders nothing when unset.
 */
import SoftChip from '@/components/ui/SoftChip'
import type { MatchContractForm } from '@/types/match'
import { useSeedLabel } from '@/lib/useSeedLabel'

export default function ContractFormChip({ contractForm }: { contractForm?: MatchContractForm | null }) {
  // A seeded contract form renders in the user language; a tenant value stays as typed.
  const seedLabel = useSeedLabel()
  if (!contractForm) return null
  return <SoftChip label={seedLabel('candidateTypes', { value: contractForm.value, label: contractForm.label })} color={contractForm.color} />
}
