import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface VacancyLinkOption { value: Id; label: string; client?: string }

/**
 * useVacancyLinkOptions — vacancy picker options shared by the application
 * Details block (ApplicationTab) and the Vacature tab's "Vacature koppelen"
 * flow (VacancyTab), so both surfaces read the same option shape and never
 * fork (§3A: extend, never duplicate). Loads /vacancies only while `enabled`
 * (the picker is open) — data minimisation, §8/§9. Plain useState/useEffect
 * (not React Query) so this hook renders fine without a QueryClientProvider
 * in unit tests, mirroring AddApplicationModal's own load.
 */
export function useVacancyLinkOptions(enabled: boolean): VacancyLinkOption[] {
  const [options, setOptions] = useState<VacancyLinkOption[]>([])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    api.get('/vacancies', { params: { per_page: 100 } })
      .then(res => {
        if (!alive) return
        const { rows } = unwrapList<{ id?: Id; title?: string; titel?: string; client_name?: string; client?: string }>(res)
        setOptions(rows.map(v => ({ value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client })))
      })
      .catch(() => { if (alive) setOptions([]) })
    return () => { alive = false }
  }, [enabled])

  return options
}
