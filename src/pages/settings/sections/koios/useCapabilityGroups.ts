/**
 * useCapabilityGroups — KOIOS-TOOL-MATRIX-FE-3. Derives a real, navigable DOMAIN
 * axis from each tool's `connection` and `name`, replacing the read/write-only
 * split (verdict finding 1: 61 of 78 tools landed in one "write" tab, still
 * ~6200px tall). `kind` (read/write) stays as an in-tab section header, which is
 * what it is actually good for.
 *
 * Name-derivation note: the measured payload (GET /ai/koios/capabilities,
 * tenant yesway, saved to scratchpad/capabilities-real.json) carries Dutch
 * VERB-first tool names ("zoek_kandidaten", "wijs_sollicitatie_af"), not a
 * domain-prefixed vocabulary — so this scans every underscore token for the
 * FIRST one that resolves via TOKEN_DOMAIN, rather than assuming position 0.
 * Dutch plurals are irregular (kandidaat→kandidaten, afspraak→afspraken drop a
 * doubled vowel; taak→taken changes vowel entirely), so TOKEN_DOMAIN lists each
 * singular/plural form explicitly instead of guessing a prefix rule.
 */
import { useEffect, useMemo, useState } from 'react'
import type { KoiosCapabilityTool } from '@/components/layout/koios/useKoiosToolCapabilities'

export type CapabilityDomain =
  | 'candidates' | 'vacancies' | 'applications' | 'customers' | 'matches' | 'tasks'
  | 'calllists' | 'notes' | 'reports' | 'appointments' | 'workflows'
  | 'opportunities' | 'departments' | 'locations' | 'contacts'
  | 'whatsapp' | 'shiftmanager' | 'helloflex' | 'pdok' | 'other'

export interface CapabilityGroup { id: CapabilityDomain; tools: KoiosCapabilityTool[] }

// Exact tokens (both NL singular/plural and the EN vocabulary the brief named) →
// domain. Kept as literal tokens rather than prefixes: Dutch plural morphology
// (see file header) makes a startsWith rule silently miss real tool names.
const TOKEN_DOMAIN: Record<string, CapabilityDomain> = {
  kandidaat: 'candidates', kandidaten: 'candidates', candidate: 'candidates', candidates: 'candidates',
  vacature: 'vacancies', vacatures: 'vacancies', vacancy: 'vacancies', vacancies: 'vacancies',
  sollicitatie: 'applications', sollicitaties: 'applications', application: 'applications', applications: 'applications',
  klant: 'customers', klanten: 'customers', customer: 'customers', customers: 'customers',
  match: 'matches', matches: 'matches',
  taak: 'tasks', taken: 'tasks', task: 'tasks', tasks: 'tasks',
  bellijst: 'calllists', bellijsten: 'calllists', calllist: 'calllists', calllists: 'calllists',
  notitie: 'notes', notities: 'notes', note: 'notes', notes: 'notes',
  rapport: 'reports', rapporten: 'reports', report: 'reports', reports: 'reports',
  afspraak: 'appointments', afspraken: 'appointments', appointment: 'appointments', appointments: 'appointments',
  workflow: 'workflows', workflows: 'workflows',
  // Added for KOIOS-TOOL-MATRIX-FE-3 verdict finding 3: these are real entities
  // with their own drilldowns (§3A), not a catch-all — 15 of the 24 "Overig"
  // tools (kans/afdeling/locatie/contactpersoon) belonged here, not in "other".
  kans: 'opportunities', kansen: 'opportunities', opportunity: 'opportunities', opportunities: 'opportunities',
  afdeling: 'departments', afdelingen: 'departments', department: 'departments', departments: 'departments',
  locatie: 'locations', locaties: 'locations', location: 'locations', locations: 'locations',
  contactpersoon: 'contacts', contactpersonen: 'contacts', contact: 'contacts', contacts: 'contacts',
}

// Connection → domain always wins first (an explicit integration beats a name guess).
const CONNECTION_DOMAIN: Partial<Record<string, CapabilityDomain>> = {
  whatsapp: 'whatsapp', shiftmanager: 'shiftmanager', helloflex: 'helloflex', pdok: 'pdok',
}

// Known split cases under the first-token rule (KOIOS-TOOL-MATRIX-FE-3 verdict
// finding 2 — inventory for Danny, not a self-decision, per §3A CEL-DOORKLIK-CANON's
// "never self-decided" instruction): (1) the four "add a note" tools land in
// three different tabs — voeg_notitie_toe/voeg_kans_notitie_toe -> Notities
// (now Opportunities for the kans one, since 'kans' resolves before 'notitie'),
// voeg_match_notitie_toe -> Matches, voeg_taak_notitie_toe -> Taken; (2) the
// three-step interview lifecycle splits across two tabs — start_interview
// carries connection: 'whatsapp' so it groups by connection -> WhatsApp, while
// stop_interview/hervat_interview have no connection and no resolvable name
// token -> Overig. Both are the documented rule working as designed; whether
// connection should be a badge instead of a grouping axis is the open question.
// One tool's domain: connection first, then the first name token that resolves, else 'other'.
export function domainOf(tool: KoiosCapabilityTool): CapabilityDomain {
  if (tool.connection && CONNECTION_DOMAIN[tool.connection]) return CONNECTION_DOMAIN[tool.connection]!
  for (const token of tool.name.split('_')) {
    const mapped = TOKEN_DOMAIN[token]
    if (mapped) return mapped
  }
  return 'other'
}

// Groups every tool by its derived domain, ordered by tool count desc ('other' always last).
export function groupByDomain(tools: KoiosCapabilityTool[]): CapabilityGroup[] {
  const byDomain = new Map<CapabilityDomain, KoiosCapabilityTool[]>()
  tools.forEach((tool) => {
    const domain = domainOf(tool)
    if (!byDomain.has(domain)) byDomain.set(domain, [])
    byDomain.get(domain)!.push(tool)
  })
  return Array.from(byDomain.entries())
    .map(([id, groupTools]) => ({ id, tools: groupTools }))
    .sort((a, b) => (a.id === 'other' ? 1 : b.id === 'other' ? -1 : b.tools.length - a.tools.length))
}

// Case-insensitive match against a tool's label or raw name — the search bar's filter.
const matchesQuery = (tool: KoiosCapabilityTool, query: string) => {
  const q = query.toLowerCase()
  return tool.label_nl.toLowerCase().includes(q) || tool.name.toLowerCase().includes(q)
}

/**
 * The full picker: derives domain groups, tracks the active group tab (falling
 * back to the first whenever the current pick disappears), and folds a search
 * query into a flat cross-group result list so a query never hides a match
 * sitting in a different tab.
 */
export function useCapabilityGroups(tools: KoiosCapabilityTool[]) {
  const groups = useMemo(() => groupByDomain(tools), [tools])
  const [activeId, setActiveId] = useState<CapabilityDomain | null>(null)
  const [query, setQuery] = useState('')

  // Re-arm the active tab whenever the current selection no longer exists (initial load, reload, tenant switch).
  useEffect(() => {
    if (groups.length > 0 && !groups.some((g) => g.id === activeId)) setActiveId(groups[0].id)
  }, [groups, activeId])
  const active = groups.find((g) => g.id === activeId) ?? groups[0] ?? null

  const searching = query.trim().length > 0
  const searchResults = useMemo(
    () => (searching ? tools.filter((tool) => matchesQuery(tool, query.trim())) : []),
    [searching, query, tools],
  )

  return { groups, active, activeId: active?.id ?? null, setActiveId, query, setQuery, searching, searchResults }
}
