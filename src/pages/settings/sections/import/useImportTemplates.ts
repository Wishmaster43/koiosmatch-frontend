/**
 * useImportTemplates — the entity list behind the import wizard's sub-nav, fetched
 * from GET /imports/templates rather than hardcoded, so a fifth entity shows up
 * here the day the backend adds an importer for it (mirrors the jobs settings
 * hooks' load/phase/AbortController shape, e.g. useQueueSummary.js).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchImportTemplates, type ImportTemplateSummary } from './importApi'
import { orderedTemplates } from './importTemplateShape'

type Phase = 'loading' | 'ready' | 'error'

// Fetches the import-wizard's entity list from the real endpoint (see the module doc above) so a new backend importer shows up here automatically.
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

/**
 * useDefaultImportSelection — auto-picks the first template in display order once
 * the list is ready, shared by ImportWizardPage and ImportSettings (both used to
 * hand-roll the identical effect). `wantedEntity` lets a caller (the wizard's own
 * `intent` prop) pre-steer the pick to a specific entity when its template exists;
 * ImportSettings simply passes none and always lands on the first template. Never
 * overrides a selection the user already made.
 */
export function useDefaultImportSelection(
  templates: ImportTemplateSummary[], phase: Phase, wantedEntity?: string | null,
) {
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (phase === 'ready' && templates.length > 0 && !selected) {
      const wanted = wantedEntity && templates.some(tpl => tpl.entity === wantedEntity) ? wantedEntity : null
      setSelected(wanted ?? orderedTemplates(templates)[0]?.entity ?? null)
    }
  }, [phase, templates, selected, wantedEntity])
  return [selected, setSelected] as const
}
