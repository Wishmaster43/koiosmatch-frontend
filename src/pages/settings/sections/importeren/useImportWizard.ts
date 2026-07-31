/**
 * useImportWizard — the state machine behind the wizard's three steps
 * (upload -> preview -> result). Owns the async dry-run/run calls so the step
 * components stay dumb (§3A: logic in hooks, not JSX). The real import is only
 * reachable via confirmImport, which the caller gates on a SUCCESSFUL preview —
 * a dry run always happens first, never a shortcut to the real POST.
 */
import { useCallback, useState } from 'react'
import { dryRunImport, runImport, type ImportRunResult } from './importApi'
import { extractApiError } from '@/lib/extractApiError'

export type WizardStep = 'upload' | 'preview' | 'result'

type AsyncState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; result: ImportRunResult }

// One wizard instance per selected entity — the caller remounts it (React `key`)
// when the entity changes, so switching entities never carries over a stale file.
export function useImportWizard(entity: string) {
  const [step, setStep] = useState<WizardStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AsyncState>({ status: 'idle' })
  const [run, setRun] = useState<AsyncState>({ status: 'idle' })

  // A new file invalidates any previous preview — never let a stale dry run confirm.
  const selectFile = useCallback((next: File) => {
    setFile(next)
    setPreview({ status: 'idle' })
  }, [])

  // Step 1 -> 2: the mandatory preview. Stays on step 1 on failure (a FILE-level
  // problem — missing required columns, over the row cap) so the user can fix or
  // replace the file, instead of advancing into a broken preview.
  const runPreview = useCallback(async () => {
    if (!file) return
    setPreview({ status: 'loading' })
    try {
      const result = await dryRunImport(entity, file)
      setPreview({ status: 'success', result })
      setStep('preview')
    } catch (err) {
      setPreview({ status: 'error', message: extractApiError(err, '') })
    }
  }, [entity, file])

  // Step 2 -> 3: the real write. The caller only exposes this once preview.status
  // is 'success' and the summary shows at least one row that would land.
  const confirmImport = useCallback(async () => {
    if (!file) return
    setRun({ status: 'loading' })
    try {
      const result = await runImport(entity, file)
      setRun({ status: 'success', result })
      setStep('result')
    } catch (err) {
      setRun({ status: 'error', message: extractApiError(err, '') })
    }
  }, [entity, file])

  // Back to step 1 without discarding the file — e.g. the preview only showed
  // errors and the user wants to pick a different one.
  const backToUpload = useCallback(() => setStep('upload'), [])

  // Full reset for "import another file".
  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setPreview({ status: 'idle' })
    setRun({ status: 'idle' })
  }, [])

  return { step, file, preview, run, selectFile, runPreview, confirmImport, backToUpload, reset }
}
