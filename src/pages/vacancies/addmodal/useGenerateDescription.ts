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

type GenerateStatus = 'idle' | 'loading' | 'success' | 'unavailable' | 'noProfile' | 'error'

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

// The neutral prompt fields (AVG: only job data, never candidate/health data).
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

export function useGenerateDescription(fields: GenerateFormFields) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [concept, setConcept] = useState('')

  const traits = useMemo(() => buildTraits(fields), [fields])

  // Read-only transparency lookup — only fetched while the flow is open.
  const resolveQuery = useQuery({
    queryKey: ['vacancy-generate-resolve-create', traits],
    queryFn: ({ signal }) => resolveGenerationProfile(traits, signal),
    enabled: open,
    staleTime: 60_000,
  })

  // Open the flow — reset any previous concept so re-opening never shows stale text.
  const openFlow = useCallback(() => { setOpen(true); setStatus('idle'); setConcept('') }, [])
  const closeFlow = useCallback(() => { setOpen(false); setStatus('idle'); setConcept('') }, [])

  // Generate — a one-shot action; the concept never auto-applies, only the
  // caller's explicit onApply (via "Toepassen") reaches the form's description.
  const generate = useCallback(async () => {
    if (!resolveQuery.data?.profileId) { setStatus('noProfile'); return }
    setStatus('loading')
    try {
      const result = await generateVacancyText({ profileId: resolveQuery.data.profileId, fields: buildFields(fields) })
      setConcept(result.concept)
      setStatus('success')
    } catch (err) {
      const httpStatus = (err as { response?: { status?: number } })?.response?.status
      if (httpStatus === 503) setStatus('unavailable')
      else if (httpStatus === 404) setStatus('noProfile')
      else setStatus('error')
    }
  }, [resolveQuery.data, fields])

  // Discard the concept but keep the flow open so the recruiter can regenerate.
  const discard = useCallback(() => { setConcept(''); setStatus('idle') }, [])

  return {
    open, openFlow, closeFlow,
    profile: resolveQuery.data ?? null,
    resolving: open && resolveQuery.isLoading,
    resolveFailed: open && resolveQuery.isError,
    noProfileConfigured: open && !resolveQuery.isLoading && !resolveQuery.isError && !resolveQuery.data,
    status, concept, generate, discard,
  }
}
