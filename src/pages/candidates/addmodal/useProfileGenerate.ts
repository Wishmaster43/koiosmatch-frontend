/**
 * useProfileGenerate — GENERATE-FIELDS-1: "Genereer met Koios" for the create
 * form's profile-text card. Builds `fields` from the modal's OWN filled values
 * (never a second source of truth) and calls the generic /ai/koios/generate
 * endpoint. The open/status/concept/errorKey state machine is the shared
 * useGenerateFlowState (DRY round 11, mirrors useGenerateDescription's own use of it).
 */
import { useCallback } from 'react'
import { useGenerateFlowState } from '@/hooks/useGenerateFlowState'
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

// State machine for the modal's Generate-with-Koios popup: open/closed, generate status, the returned concept text, and error handling.
export function useProfileGenerate(form: FormState) {
  const { open, status, concept, errorKey, openFlow, closeFlow, discard, setStatus, setConcept, setErrorKey } = useGenerateFlowState<GenerateStatus>('idle')

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
  }, [form, setStatus, setConcept, setErrorKey])

  return { open, openFlow, closeFlow, status, concept, errorKey, generate, discard }
}
