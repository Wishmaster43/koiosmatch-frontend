/**
 * useVacanciesFilterState — owns every filter/view UI-state slice for VacanciesPage
 * (search, status/owner/client/category/branch pickers, archived/trash/agent quick
 * views, map/geo state, dashboard-intent attention) plus the derived server-side
 * filterParams, the anyFilterActive flag and the clear-all-filters handler.
 * Extracted from VacanciesPage once the page crossed the ~400 line split trigger
 * (§3) — this hook is pure state + derivation, no JSX, no data fetching.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { geocodeLocation } from '@/lib/geocode'
import { useVacancyFilterParams, type VacancyPublishedBucket } from './useVacancyFilterParams'
import { VACANCIES_MAX_PER_PAGE } from './useVacanciesData'
import type { VacancySort } from './useVacanciesData'

export function useVacanciesFilterState() {
  const { t } = useTranslation(['vacancies', 'common'])

  const [page, setPage] = usePageMemory('vac.page', 1)
  // Column sort item 4 (DATATABLE-SORT-1 reference adoption): lifted controlled sort.
  const [sort, setSort] = usePageMemory<VacancySort | null>('vac.sort', null)
  // Shared page-size hook (§ audit 2026-08-05): seeds from the tenant preference,
  // clamps to the real per_page ceiling so a 500 preference never 422s.
  const { pageSize, setPageSize, options: pageSizeOptions } = useListPageSize('vac', VACANCIES_MAX_PER_PAGE)
  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setPage(1) }

  // Server-side filter dimensions. Status is driven by the tab bar (single value).
  const [statusBucket, setStatusBucket] = usePageMemory('vac.status', 'all')
  const [selectedOwner, setSelectedOwner] = usePageMemory<string[]>('vac.owner', [])
  const [selectedClient, setSelectedClient] = usePageMemory<string[]>('vac.client', [])
  // V28: functie filter — the by_category donut's click-to-filter target.
  const [selectedCategory, setSelectedCategory] = usePageMemory<string[]>('vac.category', [])
  // VESTIGING-2: explicit branch filter (narrows within what the user may already see).
  const [selectedBranch, setSelectedBranch] = usePageMemory<string[]>('vac.branch', [])
  const [globalSearch, setGlobalSearch] = usePageMemory('vac.search', '')
  const [showArchived, setShowArchived] = usePageMemory('vac.archived', false)
  // TRASH-OVERAL-2: Prullenbak view (lifecycle pending_erase), mutually exclusive with archived.
  const [showTrash, setShowTrash] = usePageMemory('vac.trash', false)
  // VAC-AGENT-1: "online without an AI agent" quick view (?without_agent=1).
  const [showWithoutAgent, setShowWithoutAgent] = usePageMemory('vac.withoutAgent', false)
  // VAC-KPI-REDESIGN 22-07: the AI-agent donut's "real agent" segment click (?agent_id=).
  const [selectedAgentId, setSelectedAgentId] = usePageMemory<string | null>('vac.agent', null)
  // VAC-HAS-APPLICATIONS-1: "only vacancies with applications" server-side filter.
  const [hasApplications, setHasApplications] = usePageMemory('vac.hasApplications', false)
  // V27: Gepubliceerd/Niet-gepubliceerd — a real server-side filter.
  const [publishedBucket, setPublishedBucket] = usePageMemory<VacancyPublishedBucket>('vac.published', 'all')
  // STRAAL-1: map view + radius-search state (server-side ?lat=&lng=&radius=).
  const [view, setView] = usePageMemory<'table' | 'map'>('vac.viewMode', 'table')
  const [mapCenter, setMapCenter] = usePageMemory('vac.mapCenter', { lat: 52.09, lng: 5.12 })
  const [mapRadius, setMapRadius] = usePageMemory('vac.mapRadius', 30)
  // The straal filters ONLY after the user activates it (map click / radius change).
  const [mapStraalActive, setMapStraalActive] = usePageMemory('vac.mapStraal', false)
  // D1(a): the dashboard tiles' semantic attention intent — null | 'closingSoon' | 'staleStatus'.
  const [attention, setAttention] = usePageMemory<string | null>('vac.attention', null)
  // FILTER-PARITY-1: sidebar radius filter (mirrors the customer page's geoFilter).
  const [geoFilter, setGeoFilter] = usePageMemory<{ q: string; km: number; lat: number; lng: number; label: string } | null>('vac.geo', null)
  const [geoHint, setGeoHint] = useState<string | null>(null)
  const [searchEpoch, setSearchEpoch] = useState(0)

  // Server-side filter params (axios serialises arrays as `key[]`). The exact wire
  // shape lives in its own hook so it stays unit-testable (§3 size discipline).
  const filterParams = useVacancyFilterParams({
    globalSearch, statusBucket, selectedOwner, selectedClient, selectedCategory, selectedBranch,
    showArchived, showTrash, showWithoutAgent, selectedAgentId, hasApplications, publishedBucket,
    view, mapCenter, mapRadius, mapStraalActive, attention,
    geoFilter: geoFilter ? { lat: geoFilter.lat, lng: geoFilter.lng, km: geoFilter.km } : null,
  })
  const filterKey = JSON.stringify(filterParams)

  // FILTER-PARITY-1: PDOK-geocode a place/postcode for the sidebar radius filter
  // (mirrors CustomersPage's own applyGeo). Stabilized so filterGroups can depend on it.
  const applyGeo = useCallback(async (q: string, km: number) => {
    setGeoHint(null)
    const hit = await geocodeLocation(q)
    if (!hit) { setGeoHint(t('common:filters.notFound')); return }
    setGeoFilter({ q, km, lat: hit.lat, lng: hit.lng, label: `${hit.label} · ${km} km` })
  }, [t, setGeoHint, setGeoFilter])
  const clearGeo = useCallback(() => { setGeoFilter(null); setGeoHint(null) }, [setGeoFilter, setGeoHint])

  // VAC-KPI-REDESIGN 22-07: toggling "no agent" always clears the picked real-agent
  // id (mutually exclusive) — shared by the toolbar toggle, the agent donut's "Geen
  // agent" segment and the "Zonder AI-agent" KPI card.
  const toggleWithoutAgent = () => { setSelectedAgentId(null); setShowWithoutAgent(v => !v) }

  // Shared clear-all (page memory keeps filters sticky otherwise).
  const anyFilterActive = Boolean(globalSearch.trim() || showArchived || showTrash || showWithoutAgent || Boolean(selectedAgentId) || statusBucket !== 'all'
    || selectedOwner.length || selectedClient.length || selectedCategory.length || selectedBranch.length || publishedBucket !== 'all' || hasApplications || attention || geoFilter)
  // Resets every filter dimension (search, quick-views, pickers, geo) and the page
  // back to default, bumping searchEpoch so the search input itself clears too.
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setGlobalSearch(''); setShowArchived(false); setShowTrash(false); setShowWithoutAgent(false); setSelectedAgentId(null); setStatusBucket('all')
    setSelectedOwner([]); setSelectedClient([]); setSelectedCategory([]); setSelectedBranch([]); setPublishedBucket('all'); setHasApplications(false); setAttention(null)
    clearGeo(); setPage(1)
  }

  return {
    page, setPage, sort, setSort, pageSize, pageSizeOptions, handlePageSizeChange,
    statusBucket, setStatusBucket, selectedOwner, setSelectedOwner, selectedClient, setSelectedClient,
    selectedCategory, setSelectedCategory, selectedBranch, setSelectedBranch,
    globalSearch, setGlobalSearch, showArchived, setShowArchived, showTrash, setShowTrash,
    showWithoutAgent, setShowWithoutAgent, selectedAgentId, setSelectedAgentId,
    hasApplications, setHasApplications, publishedBucket, setPublishedBucket,
    view, setView, mapCenter, setMapCenter, mapRadius, setMapRadius, mapStraalActive, setMapStraalActive,
    attention, setAttention, geoFilter, geoHint, applyGeo, clearGeo,
    filterParams, filterKey, searchEpoch, setSearchEpoch,
    toggleWithoutAgent, anyFilterActive, clearAllFilters,
  }
}
