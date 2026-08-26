/**
 * useGenerateDescription — punt 17: the "Genereer met Koios" flow for the "+
 * Vacature" CREATE form. Mirrors useVacancyGenerate (drawer) but works BEFORE
 * the vacancy exists: there is no `base_vacancy_id` to seed job_title/location
 * server-side (VacancyGenerateController::fieldsFromVacancy needs a real row),
 * so this hook builds `fields` straight from the form's own current values.
 * Reuses the SAME api layer (resolveGenerationProfile/generateVacancyText) —
 * only the trait/field builders differ because the input shape differs
 * (VacancyCreateForm, not VacancyDetail).
 */
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { resolveGenerationProfile, generateVacancyText } from '../data/vacancyGenerateApi'
import type { GenerationTraits } from '../data/vacancyGenerateApi'
import { apiErrorKey } from '@/lib/extractApiError'

// 'creditExhausted' (402) is distinct from 'unavailable' (503) — a spent
// tenant budget and a temporary outage need different copy/next-step.
type GenerateStatus = 'idle' | 'loading' | 'success' | 'unavailable' | 'creditExhausted' | 'noProfile' | 'error'

// The subset of create-form fields the generate flow reads — kept narrow so the
// card only has to hand over what this flow actually needs.
export interface GenerateFormFields {
  title: string
  category: string
  industry: string
  contractTypes: string[]
  city: string
  hoursMin: string
  hoursMax: string
  customerName: string
}

// Traits the resolver scores a generation profile against (mirrors the drawer's
// buildGenerateTraits) — any missing trait is a wildcard, never a blocker.
function buildTraits(f: GenerateFormFields): GenerationTraits {
  const traits: GenerationTraits = {}
  if (f.contractTypes[0]) traits.contract_type = f.contractTypes[0]
  if (f.category) traits.function = f.category
  if (f.industry) traits.industry = f.industry
  return traits
}

// The neutral prompt fields (AVG: only job data, never candidate/health data)
// job_title/location are supplied directly here (no base_vacancy_id exists yet).
function buildFields(f: GenerateFormFields): Record<string, string> {
  const fields: Record<string, string> = {}
  if (f.title) fields.job_title = f.title
  if (f.city) fields.location = f.city
  if (f.contractTypes[0]) fields.contract_form = f.contractTypes[0]
  if (f.industry) fields.industry = f.industry
  if (f.customerName) fields.customer_name = f.customerName
  if (f.hoursMin || f.hoursMax) fields.hours = [f.hoursMin, f.hoursMax].filter(Boolean).join('-')
  return fields
}

// Orchestrates the whole popup lifecycle: open/close state, the read-only
// profile-resolve query, the one-shot generate action, and its 404/402/503
// error classification below.
export function useGenerateDescription(fields: GenerateFormFields) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [concept, setConcept] = useState('')
  // The house-mapped `common:errors.*` key for the current failure (apiErrorKey,
  // §10 code contract), or null when the caller falls back to a status-only copy.
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const traits = useMemo(() => buildTraits(fields), [fields])

  // Read-only transparency lookup — only fetched while the flow is open.
  const resolveQuery = useQuery({
    queryKey: ['vacancy-generate-resolve-create', traits],
    queryFn: ({ signal }) => resolveGenerationProfile(traits, signal),
    enabled: open,
    staleTime: 60_000,
  })

  // Open the flow — reset any previous concept so re-opening never shows stale text.
  const openFlow = useCallback(() => { setOpen(true); setStatus('idle'); setConcept(''); setErrorKey(null) }, [])
  const closeFlow = useCallback(() => { setOpen(false); setStatus('idle'); setConcept(''); setErrorKey(null) }, [])

  // Generate — a one-shot action; the concept never auto-applies, only the
  // caller's explicit onApply (via "Toepassen") reaches the form's description.
  const generate = useCallback(async () => {
    if (!resolveQuery.data?.profileId) { setStatus('noProfile'); return }
    setStatus('loading')
    setErrorKey(null)
    try {
      const result = await generateVacancyText({ profileId: resolveQuery.data.profileId, fields: buildFields(fields) })
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
  }, [resolveQuery.data, fields])

  // Discard the concept but keep the flow open so the recruiter can regenerate.
  const discard = useCallback(() => { setConcept(''); setStatus('idle'); setErrorKey(null) }, [])

  return {
    open, openFlow, closeFlow,
    profile: resolveQuery.data ?? null,
    resolving: open && resolveQuery.isLoading,
    resolveFailed: open && resolveQuery.isError,
    noProfileConfigured: open && !resolveQuery.isLoading && !resolveQuery.isError && !resolveQuery.data,
    status, concept, errorKey, generate, discard,
  }
}
