import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, getNumberSetting } from '@/lib/settings/useAllSettings'
import { deriveCandidateAdvice } from '@/lib/candidateAdvice'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Candidate } from '@/types/candidate'

/**
 * useCandidateAdvice — the ONE resolver both the candidates TABLE column and the
 * drawer "Koios AI adviseert" block call, so they can never disagree again.
 *
 * Honest gate: the backend `koios_advice` column is today filled by the seeder
 * with a RANDOM action + a fixed generic reason (no real engine runs yet). So the
 * backend value is only trusted once it declares a real origin — i.e. when
 * `advice.source` is a non-empty string (CMBE ticket KOIOS-ADVICE-1 will start
 * emitting it). Until then, the FE rule engine (candidateAdvice.ts) answers —
 * this gate auto-lifts the moment the backend ships a tagged source, no FE
 * change required.
 */
export function useCandidateAdvice(): (c: Candidate) => KoiosAdvice | null {
  const { t } = useTranslation('candidates')
  const { phases, statusMeta } = useLookups()
  const settings = useAllSettings()
  const staleMonths = getNumberSetting(settings, 'no_contact_alert_months', 6)
  const entryPhase = phases[0]?.value ?? 'lead'

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((c: Candidate): KoiosAdvice | null => {
    // Trust the backend value only once it declares a real, non-seeded origin.
    // `source` sits on the catch-all index signature of CandidateAdvice, so it
    // is read as `unknown` and narrowed to a string here.
    const backendSource = typeof c.koiosAdvice?.source === 'string' ? c.koiosAdvice.source : null
    if (backendSource) {
      const backendAction = c.koiosAdvice?.action ?? 'none'
      if (backendAction === 'none') return null
      return {
        action: backendAction,
        label: c.koiosAdvice?.label ?? null,
        reason: c.koiosAdvice?.reason ?? null,
        source: backendSource,
      }
    }

    const isBlacklist = Boolean(statusMeta(c.status)?.is_blacklist)
    const rule = deriveCandidateAdvice(c, { staleMonths, entryPhase, isBlacklist })
    if (rule.action === 'none') return null

    return {
      action: rule.action,
      label: t(`koios.actions.${rule.action}`),
      reason: t(rule.reasonKey, rule.reasonParams),
      source: 'rules',
    }
  }, [t, statusMeta, staleMonths, entryPhase])
}
