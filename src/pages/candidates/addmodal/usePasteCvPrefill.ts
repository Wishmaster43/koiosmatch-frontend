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

export function usePasteCvPrefill(form: FormState, applyPatch: (patch: Partial<FormState>) => void) {
  const [cvFilled, setCvFilled] = useState<ReadonlySet<string>>(() => new Set<string>())
  const [summary, setSummary] = useState<CvPrefillResult | null>(null)

  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])

  const onReady = useCallback((fields: ParsedCvFields) => {
    const result = buildCvPrefill(fields, formRef.current)
    applyPatch(result.patch)
    setCvFilled(new Set(result.filled))
    setSummary(result)
  }, [applyPatch])

  const cv = useCvParse({ onReady })

  const clearMark = useCallback((key: string) => {
    setCvFilled(prev => prev.has(key) ? new Set([...prev].filter(name => name !== key)) : prev)
  }, [])

  return { cv, cvFilled, summary, clearMark }
}
