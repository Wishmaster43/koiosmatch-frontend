/**
 * useVacancyGenerate — VACGEN-1 fase 1b: drives the "Genereer met Koios" flow on
 * an existing vacancy. Resolves the applicable generation profile (read-only
 * transparency chip via react-query, K-33 — a lookup/server-state read) then
 * generates a CONCEPT via a plain one-shot async action (mirrors
 * useVacancyBulkActions' pattern — a single mutation, not react-query server
 * state). The concept only lives in local state: nothing reaches the caller
 * until `applyConcept` is invoked, so the already-saved description is never
 * silently overwritten (§3).
 *
 * No override picker here on purpose — see VacancyGenerateFlow's header comment
 * (GET /vacancy-generation-profiles is gated behind the admin-only
 * vacancy_generation.manage permission, which most vacancy-creators lack).
 */
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { resolveGenerationProfile, generateVacancyText, buildGenerateFields, buildGenerateTraits } from '../data/vacancyGenerateApi'
import type { VacancyDetail } from '@/types/vacancy'

type GenerateStatus = 'idle' | 'loading' | 'success' | 'unavailable' | 'noProfile' | 'error'

export function useVacancyGenerate(vacancy: VacancyDetail) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [concept, setConcept] = useState('')

  // Best-effort dims from the vacancy record (memoised so the query key/effect
  // don't churn on every render).
  const traits = useMemo(() => buildGenerateTraits(vacancy), [vacancy])

  // Read-only transparency lookup — only fetched while the flow is open, never
  // eagerly on drawer mount.
  const resolveQuery = useQuery({
    queryKey: ['vacancy-generate-resolve', vacancy.id, traits],
    queryFn: ({ signal }) => resolveGenerationProfile(traits, signal),
    enabled: open,
    staleTime: 60_000,
  })

  // Open the flow — reset any previous concept so re-opening never shows stale text.
  const openFlow = useCallback(() => { setOpen(true); setStatus('idle'); setConcept('') }, [])
  // Close the flow entirely (also used right after a successful Apply).
  const closeFlow = useCallback(() => { setOpen(false); setStatus('idle'); setConcept('') }, [])

  // Generate — a one-shot action; the result never auto-applies, only the
  // caller's explicit applyConcept()/onApply reaches the saved record.
  const generate = useCallback(async () => {
    if (!resolveQuery.data?.profileId) { setStatus('noProfile'); return }
    setStatus('loading')
    try {
      const result = await generateVacancyText({
        profileId: resolveQuery.data.profileId,
        baseVacancyId: vacancy.id != null ? String(vacancy.id) : undefined,
        fields: buildGenerateFields(vacancy),
      })
      setConcept(result.concept)
      setStatus('success')
    } catch (err) {
      const httpStatus = (err as { response?: { status?: number } })?.response?.status
      if (httpStatus === 503) setStatus('unavailable')
      else if (httpStatus === 404) setStatus('noProfile')
      else setStatus('error')
    }
  }, [resolveQuery.data, vacancy])

  // Discard the concept but keep the flow open so the recruiter can regenerate.
  const discard = useCallback(() => { setConcept(''); setStatus('idle') }, [])

  return {
    open, openFlow, closeFlow,
    profile: resolveQuery.data ?? null,
    resolving: open && resolveQuery.isLoading,
    resolveFailed: open && resolveQuery.isError,
    // No profile at all for this tenant — Generate stays disabled with an honest notice.
    noProfileConfigured: open && !resolveQuery.isLoading && !resolveQuery.isError && !resolveQuery.data,
    status, concept, generate, discard,
  }
}
