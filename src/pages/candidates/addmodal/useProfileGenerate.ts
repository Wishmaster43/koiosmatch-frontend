/**
 * useProfileGenerate — GENERATE-FIELDS-1: "Genereer met Koios" for the create
 * form's profile-text card. Builds `fields` from the modal's OWN filled values
 * (never a second source of truth) and calls the generic /ai/koios/generate
 * endpoint. Mirrors useGenerateDescription's status machine (§3A pattern reuse).
 */
import { useCallback, useState } from 'react'
import { generateFromFields } from './candidateGenerateApi'
import { apiErrorKey } from '@/lib/extractApiError'
import type { FormState } from '../AddCandidateModal'

type GenerateStatus = 'idle' | 'loading' | 'success' | 'unavailable' | 'creditExhausted' | 'error'

// Only non-empty, short values go into the prompt — max 30 keys/2000 chars is a
// server rule; the modal form never approaches that, so no truncation needed here.
function buildFields(form: FormState): Record<string, string> {
  const fields: Record<string, string> = {}
  const map: Array<[keyof FormState, string]> = [
    ['firstName', 'first_name'], ['lastName', 'last_name'], ['functionTitle', 'function_title'],
    ['city', 'city'], ['province', 'province'],
  ]
  for (const [key, apiKey] of map) {
    const value = String(form[key] ?? '').trim()
    if (value) fields[apiKey] = value
  }
  return fields
}

export function useProfileGenerate(form: FormState) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [concept, setConcept] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const openFlow = useCallback(() => { setOpen(true); setStatus('idle'); setConcept(''); setErrorKey(null) }, [])
  const closeFlow = useCallback(() => { setOpen(false); setStatus('idle'); setConcept(''); setErrorKey(null) }, [])

  // One-shot generate — never auto-applies; only the caller's explicit "apply" reaches the form.
  const generate = useCallback(async () => {
    setStatus('loading')
    setErrorKey(null)
    try {
      const text = await generateFromFields({ entity: 'candidate', fields: buildFields(form) })
      setConcept(text)
      setStatus('success')
    } catch (err) {
      const httpStatus = (err as { response?: { status?: number } })?.response?.status
      if (httpStatus === 402) { setStatus('creditExhausted'); setErrorKey(apiErrorKey(err) ?? 'errors.koiosCreditExhausted') }
      else if (httpStatus === 503) { setStatus('unavailable'); setErrorKey(apiErrorKey(err) ?? 'errors.koiosUnavailable') }
      else setStatus('error')
    }
  }, [form])

  const discard = useCallback(() => { setConcept(''); setStatus('idle'); setErrorKey(null) }, [])

  return { open, openFlow, closeFlow, status, concept, errorKey, generate, discard }
}
