/**
 * useGuardedSubmit — ONE submit in flight per dialog (ONIX N-007, FE correctness):
 * a double-click on "Aanmaken" created two identical contacts/locations/departments
 * because those dialogs had no saving state. The guard ignores every call while the
 * previous one is still running, exposes `saving` for the footer (button busy +
 * disabled), and always resets — a rejected run must not leave the dialog stuck.
 * A single click behaves exactly as before.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface GuardedSubmit {
  submit: () => Promise<void>
  saving: boolean
}

// Wraps an async submit so re-entrant calls are dropped until it settles.
export function useGuardedSubmit(run: () => Promise<void>): GuardedSubmit {
  const [saving, setSaving] = useState(false)
  // The re-entrancy latch lives in a ref (written in the handler only, never during
  // render) because state updates are asynchronous: two clicks in one tick would
  // both read `saving === false`.
  const inFlight = useRef(false)
  // The latest run function, kept in a ref written by an effect (REFS-IN-EFFECTS-1:
  // never during render) so the memoised submit never calls a stale closure.
  const runRef = useRef(run)
  useEffect(() => { runRef.current = run })

  const submit = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    try {
      await runRef.current()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }, [])

  return { submit, saving }
}
