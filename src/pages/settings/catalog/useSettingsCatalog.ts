/**
 * useSettingsCatalog — loads the settings catalogue (GET /settings/catalog,
 * DRAFT-SETTINGS-CATALOG-1 §1) through the configured API client and exposes the
 * sections plus an alias → canonical-key map for the alias release (§3).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CatalogSection, SettingsCatalogResponse } from './catalogTypes'

// Query key shared by every consumer so one fetch serves all catalogue screens.
export const SETTINGS_CATALOG_QUERY_KEY = ['settings', 'catalog'] as const

// Fetches the catalogue; tolerant of a bare or `{data}`-wrapped envelope.
async function fetchCatalog(): Promise<SettingsCatalogResponse['data']> {
  const res = await api.get<SettingsCatalogResponse | SettingsCatalogResponse['data']>('/settings/catalog')
  const body = res.data as SettingsCatalogResponse | SettingsCatalogResponse['data']
  return 'data' in body ? body.data : body
}

// Hook: catalogue sections, version and the alias map; the catalogue is static per deploy, so it stays fresh for the session.
export function useSettingsCatalog() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SETTINGS_CATALOG_QUERY_KEY,
    queryFn: fetchCatalog,
    staleTime: Infinity,
  })
  const sections: CatalogSection[] = useMemo(() => data?.sections ?? [], [data])
  // Every row's aliases point at its canonical key (old FE names → contract names).
  const aliasToCanonical = useMemo(() => {
    const map: Record<string, string> = {}
    sections.forEach(section => section.keys.forEach(row => row.aliases.forEach(alias => { map[alias] = row.key })))
    return map
  }, [sections])
  return { sections, version: data?.version ?? '', aliasToCanonical, isLoading, isError, refetch }
}
