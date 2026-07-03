/**
 * Candidate write/read operations that aren't part of the list hook: creating a
 * candidate (POST /candidates), loading a full detail record (GET /candidates/{id})
 * and persisting drawer/header edits (PATCH). Kept out of the page/modal so those
 * stay presentational (§3). The detail GET soft-fails (→ null); the PATCH surfaces
 * notifyError on failure (ERR-1). createCandidate RETHROWS so the modal can still
 * map field-level 422 validation errors.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { mapCandidate } from '../data/mapCandidate'
import { buildCandidatePatch } from '../data/candidatesShared'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Create a candidate (POST /candidates) → mapped Candidate. Rethrows on failure so
// the caller can surface 422 field errors; tracks a `saving` flag for the button.
export function useCreateCandidate() {
  const [saving, setSaving] = useState(false)
  const createCandidate = async (body: Record<string, unknown>): Promise<Candidate> => {
    setSaving(true)
    try {
      const r = await api.post('/candidates', body)
      return mapCandidate(r.data?.data ?? r.data)
    } finally {
      setSaving(false)
    }
  }
  return { createCandidate, saving }
}

// Full-record load + edit persistence for the candidate drawer.
export function useCandidateRecord() {
  const { t } = useTranslation('candidates')

  // GET the full detail record. 404 → 'gone' (a stale row: the record no longer exists,
  // e.g. after a reseed or another user's delete) so the page can drop the row + tell the
  // user; any other failure soft-fails to null (keep the light row, no data loss).
  const fetchDetail = async (id: Id): Promise<Candidate | 'gone' | null> => {
    try {
      const r = await api.get(`/candidates/${id}`)
      return mapCandidate(r.data?.data ?? r.data)
    } catch (e) {
      return (e as { response?: { status?: number } })?.response?.status === 404 ? 'gone' : null
    }
  }

  // Persist a UI patch (mapped to the API body); notifyError on failure (ERR-1).
  const patchCandidate = (id: Id, patch: Record<string, unknown>) => {
    const body = buildCandidatePatch(patch)
    if (Object.keys(body).length) {
      api.patch(`/candidates/${id}`, body).catch(() => notifyError(t('common:actionFailed')))
    }
  }

  return { fetchDetail, patchCandidate }
}
