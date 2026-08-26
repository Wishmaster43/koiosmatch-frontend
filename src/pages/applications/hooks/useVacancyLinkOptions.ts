/**
 * useVacancyLinkOptions — vacancy picker options shared by the application
 * Details block (ApplicationTab) and the Vacature ("Vacancy") tab's own
 * "Vacature koppelen" ("Link vacancy") flow (VacancyTab), so both surfaces
 * read the same option shape and never fork (§3A: extend, never duplicate).
 * Loads /vacancies only while `enabled` (the picker is open) — data
 * minimisation, §8/§9. Plain useState/useEffect (not React Query) so this
 * hook renders fine without a QueryClientProvider in unit tests, mirroring
 * AddApplicationModal's own load.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface VacancyLinkOption { value: Id; label: string; client?: string }

// Shared vacancy-picker options for the application details block and the
// Vacature tab's own link flow; fetches only while `enabled` (§8/§9 data minimisation).
// Returns an explicit `error` flag so a failed fetch can't be mistaken for a
// genuinely empty vocabulary (both consumers should show a real error state).
export function useVacancyLinkOptions(enabled: boolean): { options: VacancyLinkOption[]; error: boolean } {
  const [options, setOptions] = useState<VacancyLinkOption[]>([])
  const [error, setError] = useState(false)

  // Load once the picker becomes enabled; an alive-guard drops a stale response
  // if the hook is disabled/unmounted again before the request resolves.
  useEffect(() => {
    if (!enabled) return
    let alive = true
    setError(false)
    api.get('/vacancies', { params: { per_page: 100 } })
      .then(res => {
        if (!alive) return
        const { rows } = unwrapList<{ id?: Id; title?: string; titel?: string; client_name?: string; client?: string }>(res)
        setOptions(rows.map(v => ({ value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client })))
      })
      .catch(() => { if (alive) { setOptions([]); setError(true) } })
    return () => { alive = false }
  }, [enabled])

  return { options, error }
}
