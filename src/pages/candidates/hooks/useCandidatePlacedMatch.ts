/**
 * useCandidatePlacedMatch — the "Placed requires a Match" sub-flow, split out of
 * useCandidateStatus (§0.3 single-purpose): setting a candidate to a requires_match
 * status opens a prompt to pick an existing match or create one for a chosen vacancy;
 * confirming links it and sets deployability 'placed'. The parent still owns the
 * optimistic status override, so `setStatus` is passed in (the two share that state).
 */
import { useState } from 'react'
import { useCreateMatch } from './useCreateMatch'
import { useVacancyOptions } from './useVacancyOptions'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

interface Args {
  c: Candidate | null
  onUpdate?: (id: Id, patch: Record<string, unknown>) => void
  // The parent's optimistic status setter — 'placed' must reflect in the same session.
  setStatus: (v: string) => void
}

export function useCandidatePlacedMatch({ c, onUpdate, setStatus }: Args) {
  const { createMatch, creating: creatingMatch } = useCreateMatch(c?.id ?? '')
  const [matchPrompt,       setMatchPrompt]       = useState(false)
  const [matchChoice,       setMatchChoice]       = useState<string | null>(null)
  const [newMatchVacancyId, setNewMatchVacancyId] = useState('')
  // Vacancy picker options — only fetched while the placed prompt is open.
  const vacancyOptions = useVacancyOptions(matchPrompt)

  // Confirm the "Placed" prompt: use the picked match, or create one for the chosen vacancy.
  const confirmPlacedMatch = async () => {
    if (!c) return
    let mid = matchChoice
    if (!mid && newMatchVacancyId) mid = await createMatch(newMatchVacancyId)
    if (!mid) return
    setStatus('placed'); onUpdate?.(c.id, { status: 'placed', match_id: mid })
    setMatchPrompt(false); setMatchChoice(null); setNewMatchVacancyId('')
  }

  return {
    matchPrompt, setMatchPrompt, matchChoice, setMatchChoice,
    newMatchVacancyId, setNewMatchVacancyId, vacancyOptions, creatingMatch, confirmPlacedMatch,
  }
}
