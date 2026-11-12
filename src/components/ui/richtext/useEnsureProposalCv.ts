/**
 * useEnsureProposalCv — PROPOSAL-CV-PANEL-1: makes sure an `application_propose` action item has
 * a scan-clean proposal CV BEFORE it executes, so Koios finishes the loop without a human having
 * proposed once. Reuses the newest clean row, else renders the house-style CV client-side exactly
 * like the propose modal, stores it (the scan is synchronous). BARREL-HEAVY-1: only '@/lib/proposalCv'
 * (lazy engine) is imported here, never the renderer itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { apiErrorMessage } from '@/lib/extractApiError'
import { useCvSettings } from '@/lib/useCvSettings'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { useLocale } from '@/lib/datetime'
import { formatFileSizeMb } from '@/lib/numberFormat'
import { assertProposalCvSize, buildProposalCvBlob, PROPOSAL_CV_MAX_BYTES, ProposalCvTooLargeError } from '@/lib/proposalCv'
import type { ProposalCvVariant } from './proposalCvEnsureApi'
import { findCleanProposalCv, storeProposalCv } from './proposalCvEnsureApi'

// Candidate shape derived from the shared builder, so no barrel import is needed here.
type CvCandidate = Parameters<typeof buildProposalCvBlob>[0]['candidate']

interface ProposalSettingsShape { default_cv_variant?: string }
interface RawApplication { candidate_id?: string | number | null; candidateId?: string | number | null; candidate?: { id?: string | number | null } | null }

// Returns ensureProposalCv(applicationId) -> the clean document id; rejects with a human Error message on failure.
export function useEnsureProposalCv() {
  const { t } = useTranslation('common')
  // The CV labeller resolves cv.* keys, which live in the candidates namespace only.
  const { t: cvT } = useTranslation('candidates')
  const locale = useLocale()
  const { settings: cvSettings } = useCvSettings() as { settings?: unknown }
  const settingsValues = useAllSettings()
  const proposalSettings = getJsonSetting<ProposalSettingsShape>(settingsValues, 'application_proposal', {})
  const variant: ProposalCvVariant = proposalSettings.default_cv_variant === 'full' ? 'full' : 'proposal'
  const [preparingFor, setPreparingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Alive guard re-armed in SETUP (StrictMode); the controller aborts every request of an unmounted host.
  const aliveRef = useRef(true)
  const ctrlRef = useRef<AbortController | null>(null)
  useEffect(() => {
    aliveRef.current = true
    ctrlRef.current = new AbortController()
    return () => { aliveRef.current = false; ctrlRef.current?.abort() }
  }, [])

  // Latest render inputs for the async chain, written after render (react-hooks/refs).
  const inputsRef = useRef({ cvSettings, locale, variant, t, cvT })
  useEffect(() => { inputsRef.current = { cvSettings, locale, variant, t, cvT } })

  const ensureProposalCv = useCallback(async (applicationId: string): Promise<string> => {
    const signal = ctrlRef.current?.signal
    const { cvSettings: settings, locale: loc, variant: v, t: tr, cvT: cvTr } = inputsRef.current
    setPreparingFor(applicationId); setError(null)
    try {
      const existing = await findCleanProposalCv(applicationId, signal)
      if (existing) return existing
      const app = unwrap<RawApplication>(await api.get(`/applications/${applicationId}`, { signal }))
      const candidateId = app?.candidate_id ?? app?.candidateId ?? app?.candidate?.id
      if (candidateId == null || candidateId === '') throw new Error(tr('notesAssist.proposeCv.prepareFailed'))
      // Lazy: keeps the eager candidates barrel out of the shared notes UI graph (BARREL-DATETIME-LES).
      const { mapCandidate } = await import('@/pages/candidates/data/mapCandidate')
      const candidate = mapCandidate(unwrap(await api.get(`/candidates/${candidateId}`, { signal }))) as unknown as CvCandidate
      const blob = await buildProposalCvBlob({ candidate, settings: settings as never, locale: loc, t: cvTr as never, variant: v })
      assertProposalCvSize(blob)
      const stored = await storeProposalCv({ applicationId, blob, variant: v })
      return stored.id
    } catch (err) {
      const message = err instanceof ProposalCvTooLargeError
        ? tr('upload.tooLargeMax', { max: formatFileSizeMb(PROPOSAL_CV_MAX_BYTES, loc) })
        : apiErrorMessage(err, tr as never, tr('notesAssist.proposeCv.prepareFailed'))
      if (aliveRef.current) setError(message)
      throw new Error(message, { cause: err })
    } finally {
      if (aliveRef.current) setPreparingFor(null)
    }
  }, [])

  return { ensureProposalCv, preparingFor, error }
}
