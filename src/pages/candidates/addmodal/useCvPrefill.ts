/**
 * useCvPrefill — the create form's side of the CV parse. It owns the parse phase
 * (via useCvParse), the set of fields the parse filled and the result summary, and
 * applies a ready proposal to the form through the caller's `applyPatch`.
 *
 * It never saves. The modal's own create button stays the single confirmation step,
 * which is the whole safety model of this feature; keeping the orchestration in a
 * hook keeps that promise visible in one place instead of inside the JSX container.
 *
 * Shared by BOTH CV entry points (PASTE-CV-1's paste card and the file-upload
 * card, see AddCandidateModal.tsx) — each call site gets its own independent
 * useCvParse instance (own phase/error) for free, since every hook call creates
 * its own state; a second copy of this hook was never needed to keep the two
 * paths from bleeding into each other.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCvParse } from './useCvParse'
import { buildCvPrefill } from './cvPrefill'
import type { CvPrefillResult, ParsedCvFields } from './cvPrefill'
import type { FormState } from '../AddCandidateModal'

export function useCvPrefill(form: FormState, applyPatch: (patch: Partial<FormState>) => void) {
  // Fields written by the parse that the recruiter has not checked yet — they render
  // with the "from CV" mark until edited.
  const [cvFilled, setCvFilled] = useState<ReadonlySet<string>>(() => new Set<string>())
  const [summary, setSummary] = useState<CvPrefillResult | null>(null)

  // Mirror of the live form, so the async parse maps against what is on screen NOW
  // rather than the values captured when the poll started.
  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])

  // buildCvPrefill owns the safety rules (whitelist, no free text, never overwrite);
  // this only applies the result and records what happened.
  const onReady = useCallback((fields: ParsedCvFields) => {
    const result = buildCvPrefill(fields, formRef.current)
    applyPatch(result.patch)
    setCvFilled(new Set(result.filled))
    setSummary(result)
  }, [applyPatch])

  const cv = useCvParse({ onReady })

  // Editing a CV-prefilled field means the recruiter checked it — drop the mark.
  const clearMark = useCallback((key: string) => {
    setCvFilled(prev => prev.has(key) ? new Set([...prev].filter(name => name !== key)) : prev)
  }, [])

  return { cv, cvFilled, summary, clearMark }
}
