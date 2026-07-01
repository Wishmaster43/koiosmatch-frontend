/**
 * useCreateMatch — create a match for a candidate (C-19: POST /candidates/{id}/matches).
 * Kept out of the drawer so it stays presentational (§3). Returns the new match id,
 * or null on failure (notifyError, ERR-1). The endpoint is pending backend C-19; the
 * call degrades gracefully (toast) until it exists.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Id } from '@/types/common'

export function useCreateMatch(candidateId: Id) {
  const { t } = useTranslation('candidates')
  const [creating, setCreating] = useState(false)

  // Create a bare match from a vacancy/role title; returns its id (string) or null.
  const createMatch = async (vacancyTitle: string): Promise<string | null> => {
    setCreating(true)
    try {
      const r = await api.post(`/candidates/${candidateId}/matches`, { vacancy_title: vacancyTitle })
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
