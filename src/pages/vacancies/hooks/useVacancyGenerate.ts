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
import { apiErrorKey } from '@/lib/extractApiError'
import type { VacancyDetail } from '@/types/vacancy'

// 'creditExhausted' (402) is distinct from 'unavailable' (503) — a spent
// tenant budget and a temporary outage need different copy/next-step.
type GenerateStatus = 'idle' | 'loading' | 'success' | 'unavailable' | 'creditExhausted' | 'noProfile' | 'error'

export function useVacancyGenerate(vacancy: VacancyDetail) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [concept, setConcept] = useState('')
  // The house-mapped `common:errors.*` key for the current failure (apiErrorKey,
  // §10 code contract), or null when the caller falls back to a status-only copy.
  const [errorKey, setErrorKey] = useState<string | null>(null)

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
  const openFlow = useCallback(() => { setOpen(true); setStatus('idle'); setConcept(''); setErrorKey(null) }, [])
  // Close the flow entirely (also used right after a successful Apply).
  const closeFlow = useCallback(() => { setOpen(false); setStatus('idle'); setConcept(''); setErrorKey(null) }, [])

  // Generate — a one-shot action; the result never auto-applies, only the
  // caller's explicit applyConcept()/onApply reaches the saved record.
  const generate = useCallback(async () => {
    if (!resolveQuery.data?.profileId) { setStatus('noProfile'); return }
    setStatus('loading')
    setErrorKey(null)
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
      // 404 = no profile resolved. 402 = tenant credit exhausted. 503 = the
      // service is temporarily down. Anything else is a real failure — never
      // silenced as one of the calm states. The code-based key (apiErrorKey)
      // wins over the status heuristic when the backend supplies one (§10).
      if (httpStatus === 404) setStatus('noProfile')
      else if (httpStatus === 402) { setStatus('creditExhausted'); setErrorKey(apiErrorKey(err) ?? 'errors.koiosCreditExhausted') }
      else if (httpStatus === 503) { setStatus('unavailable'); setErrorKey(apiErrorKey(err) ?? 'errors.koiosUnavailable') }
      else setStatus('error')
    }
  }, [resolveQuery.data, vacancy])

  // Discard the concept but keep the flow open so the recruiter can regenerate.
  const discard = useCallback(() => { setConcept(''); setStatus('idle'); setErrorKey(null) }, [])

  return {
    open, openFlow, closeFlow,
    profile: resolveQuery.data ?? null,
    resolving: open && resolveQuery.isLoading,
    resolveFailed: open && resolveQuery.isError,
    // No profile at all for this tenant — Generate stays disabled with an honest notice.
    noProfileConfigured: open && !resolveQuery.isLoading && !resolveQuery.isError && !resolveQuery.data,
    status, concept, errorKey, generate, discard,
  }
}
