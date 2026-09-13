/**
 * settingsListCardStyles — shared building blocks for the settings
 * "expandable list" screens (MatchTemplatesSettings, VacancyContentBlocksSettings,
 * VacancyGenerationProfilesList): the card/label/input style trio (one boxed
 * row per record, an 11px muted field label, the canon field input from
 * G33/fieldMetrics), the 404-vs-real-error load classifier, and the shared
 * expand/adding/saving/editForms UI-state quartet. Extracted so the three
 * near-identical copies don't drift. The label takes the GroupLabel atom's identity.
 */
import { useEffect, useRef, useState } from 'react'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { groupLabelStyle } from '@/components/ui/typography'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'

export const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }
// Field label = the GroupLabel atom's identity (11/600 muted uppercase); only the layout is local.
export const labelStyle = { ...groupLabelStyle, display: 'block', marginBottom: 4 }
// Canon field style (G33/fieldMetrics) — was its own padding-6/radius-6 copy per file.
export const inputStyle = fieldInputStyle

/**
 * classifyListLoadPhase — shared 404-vs-real-error classification for a
 * settings CRUD list's load effect (VacancyContentBlocksSettings/
 * VacancyGenerationProfilesList): a 404 means the backend route isn't
 * deployed yet (a calm "unavailable" notice), anything else is a real error.
 */
export function classifyListLoadPhase(e: unknown): 'unavailable' | 'error' {
  const status = (e as { response?: { status?: number } })?.response?.status
  return status === 404 ? 'unavailable' : 'error'
}

/**
 * useSettingsListUiState — the shared expand/adding/saving/editForms quartet
 * every settings "expandable list" screen owns (MatchTemplatesSettings/
 * VacancyContentBlocksSettings/VacancyGenerationProfilesList). Each screen
 * still keeps its own record-list state and `newForm` draft shape.
 */
export function useSettingsListUiState() {
  const [expanded, setExpanded] = useState<string | number | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState<string | number | null>(null) // 'new' | record id | null
  const [editForms, setEditForms] = useState<Record<string, unknown>>({})
  return { expanded, setExpanded, adding, setAdding, saving, setSaving, editForms, setEditForms }
}

/**
 * useSettingsListLoad — the shared alive-guarded load effect every settings
 * "expandable list" screen runs once on mount (VacancyContentBlocksSettings/
 * VacancyGenerationProfilesList): `fetcher` resolves to an `apply` callback
 * that stores the fetched rows in the caller's own state (one fetch or a
 * Promise.all of several — the hook doesn't care), then the phase flips to
 * 'ready'; any rejection classifies via `classifyListLoadPhase`. The alive
 * guard lives here once instead of being hand-copied per screen.
 */
export function useSettingsListLoad(
  fetcher: () => Promise<() => void>,
  setPhase: (phase: 'ready' | 'unavailable' | 'error') => void,
) {
  // The load runs once on mount but reads the CURRENT callbacks through refs, so the
  // effect's deps are honest (no exhaustive-deps disable) and a re-rendered screen never refetches.
  const fetcherRef = useRef(fetcher)
  const setPhaseRef = useRef(setPhase)
  // Refs are written in an effect (never during render); this one runs before the mount-once load below.
  useEffect(() => {
    fetcherRef.current = fetcher
    setPhaseRef.current = setPhase
  })
  useEffect(() => {
    let alive = true
    fetcherRef.current().then((apply) => {
      if (!alive) return
      apply()
      setPhaseRef.current('ready')
    }).catch((e) => {
      if (!alive) return
      setPhaseRef.current(classifyListLoadPhase(e))
    })
    return () => { alive = false }
  }, [])
}

/**
 * runSettingsListCreate — the shared trim-guard → POST → append → reset-draft
 * body every settings "expandable list" screen's `handleCreate` runs
 * (VacancyContentBlocksSettings/VacancyGenerationProfilesList): `body` is the
 * already-shaped API payload (the caller decides its own flattening/mapping),
 * `emptyDraft` reseeds the create-card's local draft state on success.
 */
export async function runSettingsListCreate<T>(opts: {
  name: string
  endpoint: string
  body: unknown
  setSaving: (v: string | number | null) => void
  setList: (updater: (prev: T[]) => T[]) => void
  setNewForm: (v: T) => void
  emptyDraft: () => T
  setAdding: (v: boolean) => void
  errorMessage: string
}) {
  const name = opts.name.trim()
  if (!name) return
  opts.setSaving('new')
  try {
    const res = await api.post(opts.endpoint, opts.body)
    opts.setList((p) => [...p, unwrap(res)])
    opts.setNewForm(opts.emptyDraft())
    opts.setAdding(false)
  } catch {
    notifyError(opts.errorMessage)
  } finally {
    opts.setSaving(null)
  }
}
