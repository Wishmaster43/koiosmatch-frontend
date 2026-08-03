/**
 * useValidateAndRun — the dry-run/run calls for the wizard's preview + confirm steps.
 *
 * This does NOT reuse settings/importeren's `useImportWizard` hook: that hook stores
 * the file in React state and reads it back from its OWN closure inside `runPreview`,
 * which fits a UI where "pick file" and "run preview" are two SEPARATE clicks across
 * two renders. This wizard instead REBUILDS the file from the current mapped+edited
 * rows and validates it in one synchronous handler — calling `selectFile(file)`
 * immediately followed by `runPreview()` would read the PREVIOUS file from a stale
 * closure (the state update from selectFile has not re-rendered yet). Taking the
 * file as an explicit argument on each call sidesteps that entirely. The AsyncState
 * shape and extractApiError usage still mirror useImportWizard's own, so the two
 * stay easy to compare.
 */
import { useCallback, useState } from 'react'
import { dryRunImport, runImport, type ImportRunResult } from '../api'
import { extractApiError } from '@/lib/extractApiError'

type AsyncState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; result: ImportRunResult }

export function useValidateAndRun(entity: string) {
  const [preview, setPreview] = useState<AsyncState>({ status: 'idle' })
  const [run, setRun] = useState<AsyncState>({ status: 'idle' })

  // The dry-run — writes nothing, returns whether it succeeded so the caller can
  // mark the current rows as validated (useMappingWizard.markValidated).
  const validate = useCallback(async (file: File): Promise<boolean> => {
    setPreview({ status: 'loading' })
    setRun({ status: 'idle' })
    try {
      const result = await dryRunImport(entity, file)
      setPreview({ status: 'success', result })
      return true
    } catch (err) {
      setPreview({ status: 'error', message: extractApiError(err, '') })
      return false
    }
  }, [entity])

  // The real write — only ever called once the caller confirms a validated file.
  const confirm = useCallback(async (file: File): Promise<boolean> => {
    setRun({ status: 'loading' })
    try {
      const result = await runImport(entity, file)
      setRun({ status: 'success', result })
      return true
    } catch (err) {
      setRun({ status: 'error', message: extractApiError(err, '') })
      return false
    }
  }, [entity])

  const reset = useCallback(() => {
    setPreview({ status: 'idle' })
    setRun({ status: 'idle' })
  }, [])

  return { preview, run, validate, confirm, reset }
}
