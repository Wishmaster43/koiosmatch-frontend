/**
 * useVacancyFilterParams — builds the server-side filter params for the vacancy list
 * AND stats (both requests send this exact object, so every KPI/donut filter narrows
 * the aggregates too). Extracted from VacanciesPage once the page crossed the ~400
 * line split trigger (§3), and so the WIRE SHAPE is unit-testable on its own: a
 * filter that ships the wrong key is a dead control, not a cosmetic bug.
 *
 * Booleans go out as numeric 1/0 — Laravel's strict `boolean` rule rejects the
 * "true"/"false" strings a JS boolean serialises to in a query string (a real 422
 * caught on `published` before V27).
 */
import { useMemo } from 'react'
import { isReferenceQuery } from '@/lib/referenceNumber'

export type VacancyPublishedBucket = 'all' | 'published' | 'unpublished'

export interface VacancyFilterState {
  globalSearch: string
  statusBucket: string
  selectedOwner: string[]
  selectedClient: string[]
  selectedCategory: string[]
  selectedBranch: string[]
  showArchived: boolean
  // TRASH-OVERAL-2: the Prullenbak view — same include_archived request as the
  // archived view; the page splits the result client-side on lifecycle.
  showTrash: boolean
  showWithoutAgent: boolean
  selectedAgentId: string | null
  // VAC-HAS-APPLICATIONS-1: the "Sollicitaties" KPI card's server-wide quick view.
  hasApplications: boolean
  publishedBucket: VacancyPublishedBucket
  view: 'table' | 'map'
  mapCenter: { lat: number; lng: number }
  mapRadius: number
  mapStraalActive: boolean
  // D1(a) dashboard-intent attention value: null | 'closingSoon' | 'staleStatus'.
  attention: string | null
  // FILTER-PARITY-1: a place/postcode geocoded via the sidebar's radius filter
  // (mirrors the customer page's geoFilter) — applied outside the map view, since
  // the map's own straal control already covers the map-view case above.
  geoFilter?: { lat: number; lng: number; km: number } | null
}

export function useVacancyFilterParams({
  globalSearch, statusBucket, selectedOwner, selectedClient, selectedCategory, selectedBranch,
  showArchived, showTrash, showWithoutAgent, selectedAgentId, hasApplications, publishedBucket,
  view, mapCenter, mapRadius, mapStraalActive, attention, geoFilter,
}: VacancyFilterState): Record<string, unknown> {
  return useMemo(() => {
    const p: Record<string, unknown> = {}
    // NUMMER-1: a typed reference number (V-12) does an exact server-side `?ref=`
    // lookup instead of the normal free-text search; the server ignores other filters.
    if (globalSearch.trim()) {
      const q = globalSearch.trim()
      if (isReferenceQuery(q)) p.ref = q
      else p.search = q
    }
    // '__none' = the "Geen status" donut segment → server-side no_status filter (VAC-NOSTATUS-1).
    if (statusBucket === '__none')   p.no_status = 1
    else if (statusBucket !== 'all') p.status    = [statusBucket]
    if (selectedOwner.length)   p.owner_id    = selectedOwner
    if (selectedClient.length)  p.customer_id = selectedClient
    // V28: functie donut filter — VacancyQuery::filtered() already whereIn's on function_title.
    if (selectedCategory.length) p.category  = selectedCategory
    // VESTIGING-2: server-side ?branch_id[]= — a narrowing only, gated behind the
    // tenant's own branch_authz_enabled axis on the backend (off = no effect).
    if (selectedBranch.length)  p.branch_id = selectedBranch
    // TRASH-OVERAL-1b: include_archived=1 returns ONLY soft-deleted rows (archived
    // + pending_erase); the page's lifecycle filter splits them per view.
    if (showArchived || showTrash) p.include_archived = 1
    // VAC-AGENT-1: quick view onto the vacancies that are online but have no agent linked.
    if (showWithoutAgent)       p.without_agent = 1
    // VAC-KPI-REDESIGN 22-07: the AI-agent donut's real-agent segment click.
    else if (selectedAgentId)   p.agent_id = selectedAgentId
    // VAC-HAS-APPLICATIONS-1: vacancies with ≥1 coupled application. Listed in
    // VacancyQuery::BOOLEAN_FILTERS and applied as one whereHas('applications')
    // EXISTS subquery, so this is a real server-wide filter — not a page-scope trim.
    if (hasApplications)        p.has_applications = 1
    // V27: server-side published/unpublished filter (honoured by both the list and stats).
    if (publishedBucket !== 'all') p.published = publishedBucket === 'published' ? 1 : 0
    // Map view narrows the list server-side to the chosen circle (STRAAL-1); the
    // sidebar's own radius filter (FILTER-PARITY-1) applies outside the map view.
    if (view === 'map' && mapStraalActive) { p.lat = mapCenter.lat; p.lng = mapCenter.lng; p.radius = mapRadius }
    else if (geoFilter) { p.lat = geoFilter.lat; p.lng = geoFilter.lng; p.radius = geoFilter.km }
    // D1(a) (dashboard tile → intent seam): VacancyQuery attention.closing_soon /
    // attention.stale_status, same server-wide filters the dashboard KPI itself reads.
    if (attention === 'closingSoon')       p.closing_soon = 1
    else if (attention === 'staleStatus')  p.stale_status = 1
    return p
  }, [globalSearch, statusBucket, selectedOwner, selectedClient, selectedCategory, selectedBranch,
    showArchived, showTrash, showWithoutAgent, selectedAgentId, hasApplications, publishedBucket,
    view, mapCenter, mapRadius, mapStraalActive, attention, geoFilter])
}
