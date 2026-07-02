/**
 * useCreateMatch — create a match for a candidate via the canonical direct-match
 * endpoint (G-2: POST /matches { candidate_id, vacancy_id }, idempotent → sets
 * deployability Placed). Was the title-based POST /candidates/{id}/matches (C-19);
 * now there is one create path, keyed on a real vacancy (§3B "direct match").
 * Kept out of the drawer so it stays presentational (§3). Returns the new (or
 * existing) match id, or null on failure (notifyError, ERR-1).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Id } from '@/types/common'

export function useCreateMatch(candidateId: Id) {
  const { t } = useTranslation('candidates')
  const [creating, setCreating] = useState(false)

  // Couple this candidate to a vacancy; returns the match id (string) or null.
  const createMatch = async (vacancyId: Id): Promise<string | null> => {
    if (!candidateId || !vacancyId) return null
    setCreating(true)
    try {
      const r = await api.post('/matches', { candidate_id: candidateId, vacancy_id: vacancyId })
      const m = (r?.data?.data ?? r?.data) as { id?: Id } | undefined
      return m?.id != null ? String(m.id) : null
    } catch {
      notifyError(t('common:actionFailed'))
      return null
    } finally {
      setCreating(false)
    }
  }

  return { createMatch, creating }
}
