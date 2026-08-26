/**
 * usePasteCvPrefill — the paste-text sibling of useCvPrefill (PASTE-CV-1). Its
 * own useCvParse instance so the paste card's phase/error never bleeds into the
 * file-upload card's (and vice versa) — they are two independent entry points
 * into the SAME buildCvPrefill mapping, never a second mapping.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCvParse } from './useCvParse'
import { buildCvPrefill } from './cvPrefill'
import type { CvPrefillResult, ParsedCvFields } from './cvPrefill'
import type { FormState } from '../AddCandidateModal'

// Wires the paste-text CV parser to the create-form's prefill patching (see file
// docblock above) and tracks which fields were CV-filled so they can be un-marked.
export function usePasteCvPrefill(form: FormState, applyPatch: (patch: Partial<FormState>) => void) {
  const [cvFilled, setCvFilled] = useState<ReadonlySet<string>>(() => new Set<string>())
  const [summary, setSummary] = useState<CvPrefillResult | null>(null)

  // Mirrors the latest form state into a ref so onReady always reads the current
  // values without needing `form` in its own dependency array (which would tear
  // down/rebuild useCvParse on every keystroke).
  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])

  // Fires once the pasted text is parsed: builds the prefill patch against the
  // CURRENT form (never a stale snapshot) and applies it, recording which fields
  // were CV-derived so the UI can badge/clear them.
  const onReady = useCallback((fields: ParsedCvFields) => {
    const result = buildCvPrefill(fields, formRef.current)
    applyPatch(result.patch)
    setCvFilled(new Set(result.filled))
    setSummary(result)
  }, [applyPatch])

  const cv = useCvParse({ onReady })

  // Un-marks a single field as CV-filled once the recruiter has edited it themselves.
  const clearMark = useCallback((key: string) => {
    setCvFilled(prev => prev.has(key) ? new Set([...prev].filter(name => name !== key)) : prev)
  }, [])

  return { cv, cvFilled, summary, clearMark }
}
