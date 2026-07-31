/**
 * useImportTemplates — the entity list behind the import wizard's sub-nav, fetched
 * from GET /imports/templates rather than hardcoded, so a fifth entity shows up
 * here the day the backend adds an importer for it (mirrors the jobs settings
 * hooks' load/phase/AbortController shape, e.g. useQueueSummary.js).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchImportTemplates, type ImportTemplateSummary } from './importApi'

type Phase = 'loading' | 'ready' | 'error'

export function useImportTemplates() {
  const [templates, setTemplates] = useState<ImportTemplateSummary[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const abortRef = useRef<AbortController | null>(null)

  // One fetch cycle — cancels any in-flight request first (StrictMode double-mount,
  // manual reload after an error).
  const load = useCallback(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('loading')
    fetchImportTemplates(ctrl.signal)
      .then((rows) => { setTemplates(rows); setPhase('ready') })
      .catch((err) => { if (err?.code !== 'ERR_CANCELED') setPhase('error') })
  }, [])

  // Initial load; abort any in-flight request on unmount.
  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  return { templates, phase, reload: load }
}
