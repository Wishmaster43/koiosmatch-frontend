/**
 * useSettingsNavColors — one colour per settings navigation group, read from the
 * settings catalogue contract (F3, Danny 10-09 23:25: "alle instellingen 1 kleur is
 * sowieso lelijk"). Today the contract carries a colour per catalogue SECTION; a nav
 * group whose key matches a section id (company, action_rules, matching, vacancies,
 * customers, numbering, required_fields) or maps to one (kpis → kpi) takes that colour.
 * The BE publishes `nav: [{ key, icon, color }]` for every nav group (NAV-PALETTE
 * e72b19fa); the map reads it tolerantly and lets it win over the section colour.
 */
import { useMemo } from 'react'
import { useSettingsCatalog } from './useSettingsCatalog'
import type { CatalogNavEntry } from './catalogTypes'

// The minimum a section needs to contribute a colour.
export interface ColouredSection {
  id: string
  color?: string | null
}

// Nav group keys whose catalogue section carries a different id.
const SECTION_BY_NAV_KEY: Readonly<Record<string, string>> = { kpis: 'kpi' }

// Pure: nav group key → colour; sections first, then the aliases, then the BE nav palette on top.
export function navColorMap(sections: ColouredSection[], nav?: CatalogNavEntry[] | null): Record<string, string> {
  const map: Record<string, string> = {}
  sections.forEach(section => { if (section.color) map[section.id] = section.color })
  Object.entries(SECTION_BY_NAV_KEY).forEach(([navKey, sectionId]) => {
    const colour = map[sectionId]
    if (colour) map[navKey] = colour
  })
  ;(nav ?? []).forEach(entry => { if (entry.color) map[entry.key] = entry.color })
  return map
}

// Hook: `colorOf(groupKey)` for the settings sidebar; undefined keeps the muted default.
export function useSettingsNavColors() {
  const { sections, nav } = useSettingsCatalog()
  const map = useMemo(() => navColorMap(sections, nav), [sections, nav])
  const colorOf = (groupKey: string): string | undefined => map[groupKey]
  return { colorOf, map }
}
