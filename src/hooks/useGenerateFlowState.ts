/**
 * useGenerateFlowState — the open/status/concept/errorKey quartet shared by
 * every "Genereer met Koios" create-form flow (candidate profile text, vacancy
 * description text — DRY round 11). Both former hooks reset the exact same way
 * on open AND close, so a stale concept/error from the previous run never
 * leaks into the next one; each caller's own `generate()` stays local (its
 * request shape and 402/404/503 branching differ per entity) and just calls
 * the exposed setters.
 */
import { useCallback, useState } from 'react'

export interface UseGenerateFlowStateResult<TStatus extends string> {
  open: boolean
  status: TStatus
  concept: string
  errorKey: string | null
  openFlow: () => void
  closeFlow: () => void
  /** Discards the concept but keeps the flow open, so the caller can regenerate. */
  discard: () => void
  setStatus: (status: TStatus) => void
  setConcept: (concept: string) => void
  setErrorKey: (key: string | null) => void
}

// Generic over the caller's own status union; `idleStatus` is that union's 'idle' member.
export function useGenerateFlowState<TStatus extends string>(idleStatus: TStatus): UseGenerateFlowStateResult<TStatus> {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<TStatus>(idleStatus)
  const [concept, setConcept] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)

  // Reset to a fresh idle state — the identical semantics both former copies shared.
  const reset = useCallback(() => { setStatus(idleStatus); setConcept(''); setErrorKey(null) }, [idleStatus])
  const openFlow = useCallback(() => { setOpen(true); reset() }, [reset])
  const closeFlow = useCallback(() => { setOpen(false); reset() }, [reset])

  return { open, status, concept, errorKey, openFlow, closeFlow, discard: reset, setStatus, setConcept, setErrorKey }
}
