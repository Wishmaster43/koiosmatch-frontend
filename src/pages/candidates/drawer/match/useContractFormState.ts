/**
 * useContractFormState — MATCH-SOORT-1's Contractvorm (candidateTypes lookup)
 * pick and its two derived flags (hasContractLines / customerNotApplicable),
 * plus the local CONTRACTREGELS draft that appears/disappears with the flag.
 * Split out of useMatchForm (§3 size split, over the ~400-line trigger) — a
 * self-contained concern: the picked value plus its own visible-state hygiene.
 */
import { useState, useEffect } from 'react'
import type { LookupItem } from '@/context/LookupsContext'
import type { MatchContractLine } from '@/types/match'

// Owns Contractvorm + its conditional CONTRACTREGELS editor state.
export function useContractFormState(candidateTypes: LookupItem[]) {
  const [contractForm, setContractForm] = useState('')
  const hasContractLines = Boolean(candidateTypes.find(ct => ct.value === contractForm)?.has_contract_lines)
  // MATCH-KLANTLOOS-1: a Contractvorm flagged `customer_not_applicable` means this
  // match has no customer — the Relaties ("Relations") card hides four fields:
  // klant (customer), locatie (location),
  // afdeling (department), contactpersoon (contact),
  // and requires a branch instead (the server rejects
  // the four fields + requires branch_id).
  const customerNotApplicable = Boolean(candidateTypes.find(ct => ct.value === contractForm)?.customer_not_applicable)
  const [contractLines, setContractLines] = useState<MatchContractLine[]>([])
  // Switching AWAY from a flagged Contractvorm clears the local draft — the
  // section disappears (§1 of the changelog: the backend cleans up orphaned
  // rows server-side, this is only the FE's own visible-state hygiene).
  useEffect(() => { if (!hasContractLines && contractLines.length) setContractLines([]) }, [hasContractLines]) // eslint-disable-line react-hooks/exhaustive-deps -- only react to the flag flipping, never to the recruiter's own row edits

  return { contractForm, setContractForm, hasContractLines, customerNotApplicable, contractLines, setContractLines }
}
